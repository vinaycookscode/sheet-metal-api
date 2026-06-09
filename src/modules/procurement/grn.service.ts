import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DocSequenceService } from '../doc-sequence/doc-sequence.service';
import { InventoryService } from '../inventory/inventory.service';
import { Grn } from './grn.entity';
import { GrnLine } from './grn-line.entity';
import { CreateGrnDto } from './dto';

interface Scope {
  plantId: string;
  userId: string;
}

const RECEIVABLE = ['approved', 'sent', 'acknowledged', 'partially_received'];

@Injectable()
export class GrnService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly docSeq: DocSequenceService,
    private readonly inventory: InventoryService,
  ) {}

  /** Receive goods against a PO (SM-143): create GRN lines, post stock, update PO fulfilment. */
  async create(s: Scope, dto: CreateGrnDto): Promise<Grn> {
    const id = await this.db.transaction(async (em) => {
      const poRows = (await em.query(
        `SELECT id, supplier_id, status FROM purchase_order WHERE id = $1 AND plant_id = $2`,
        [dto.purchaseOrderId, s.plantId],
      )) as Array<{ id: string; supplier_id: string; status: string }>;
      const po = poRows[0];
      if (!po) throw new NotFoundException('Purchase order not found');
      if (!RECEIVABLE.includes(po.status)) {
        throw new BadRequestException(`PO is '${po.status}' — cannot receive (must be approved/sent/acknowledged/partially_received)`);
      }

      const poLines = (await em.query(
        `SELECT id, item_id, qty, qty_received, unit_price FROM po_line WHERE purchase_order_id = $1`,
        [dto.purchaseOrderId],
      )) as Array<{ id: string; item_id: string; qty: string; qty_received: string; unit_price: string }>;
      const byLine = new Map(poLines.map((l) => [l.id, l]));

      const number = await this.docSeq.allocate(s.plantId, 'GRN', em);
      const grn = em.create(Grn, {
        plantId: s.plantId,
        number,
        purchaseOrderId: dto.purchaseOrderId,
        supplierId: po.supplier_id,
        status: 'posted',
        receivedDate: dto.receivedDate,
      });
      await em.save(grn);

      for (const line of dto.lines) {
        const pl = byLine.get(line.poLineId);
        if (!pl) throw new BadRequestException(`PO line ${line.poLineId} is not on this purchase order`);
        const rejected = line.qtyRejected ?? 0;
        const accepted = line.qtyReceived - rejected;
        if (accepted < 0) throw new BadRequestException('qtyRejected cannot exceed qtyReceived');

        const grnLine = em.create(GrnLine, {
          grnId: grn.id,
          poLineId: pl.id,
          itemId: pl.item_id,
          qtyReceived: line.qtyReceived,
          qtyRejected: rejected,
          heatNo: line.heatNo,
          lotNo: line.lotNo,
        });
        await em.save(grnLine);

        if (accepted > 0) {
          await this.inventory.postReceipt(em, {
            plantId: s.plantId,
            itemId: pl.item_id,
            qty: accepted,
            unitCost: Number(pl.unit_price),
            heatNo: line.heatNo,
            lotNo: line.lotNo,
            location: line.location,
            grnLineId: grnLine.id,
            byUser: s.userId,
            reference: grn.number,
          });
          await em.query(`UPDATE po_line SET qty_received = qty_received + $1 WHERE id = $2`, [accepted, pl.id]);
        }
      }

      // recompute PO fulfilment status
      const after = (await em.query(
        `SELECT BOOL_AND(qty_received >= qty) AS all_recv, BOOL_OR(qty_received > 0) AS any_recv
           FROM po_line WHERE purchase_order_id = $1`,
        [dto.purchaseOrderId],
      )) as Array<{ all_recv: boolean; any_recv: boolean }>;
      const next = after[0].all_recv ? 'received' : after[0].any_recv ? 'partially_received' : po.status;
      if (next !== po.status) {
        await em.query(`UPDATE purchase_order SET status = $1, updated_by = $2 WHERE id = $3`, [next, s.userId, dto.purchaseOrderId]);
      }
      return grn.id;
    });
    return this.findOne(s.plantId, id);
  }

  list(plantId: string, filter: { purchaseOrderId?: string }): Promise<Grn[]> {
    const where: Record<string, unknown> = { plantId };
    if (filter.purchaseOrderId) where.purchaseOrderId = filter.purchaseOrderId;
    return this.db.getRepository(Grn).find({ where, order: { createdAt: 'DESC' }, take: 500 });
  }

  async findOne(plantId: string, id: string): Promise<Grn> {
    const grn = await this.db.getRepository(Grn).findOne({ where: { id, plantId }, relations: { lines: true } });
    if (!grn) throw new NotFoundException('GRN not found');
    return grn;
  }
}
