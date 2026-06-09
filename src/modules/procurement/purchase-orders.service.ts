import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { DocSequenceService } from '../doc-sequence/doc-sequence.service';
import { MrpService } from '../planning/mrp.service';
import { PurchaseOrder } from './purchase-order.entity';
import { PoLine } from './po-line.entity';
import { CreatePurchaseOrderDto, FromRequisitionsDto } from './dto';

interface Scope {
  orgId: string;
  plantId: string;
  userId: string;
}

interface LineInput {
  itemId: string;
  qty: number;
  unitPrice: number;
  taxCodeId?: string;
  requisitionId?: string;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly docSeq: DocSequenceService,
    private readonly mrp: MrpService,
  ) {}

  async create(s: Scope, dto: CreatePurchaseOrderDto): Promise<PurchaseOrder> {
    const id = await this.db.transaction(async (em) => this.build(em, s, dto.supplierId, dto.isSubcontract, dto.orderDate, dto.lines));
    return this.findOne(s.plantId, id);
  }

  /** Requisition → PO (SM-142): consolidate requisitions onto one supplier PO. */
  async fromRequisitions(s: Scope, dto: FromRequisitionsDto): Promise<PurchaseOrder> {
    const id = await this.db.transaction(async (em) => {
      const reqIds = dto.lines.map((l) => l.requisitionId);
      const reqs = (await em.query(
        `SELECT id, item_id, qty FROM purchase_requisition WHERE id = ANY($1) AND plant_id = $2 AND is_ordered = false`,
        [reqIds, s.plantId],
      )) as Array<{ id: string; item_id: string; qty: string }>;
      const byId = new Map(reqs.map((r) => [r.id, r]));
      if (byId.size !== reqIds.length) {
        throw new BadRequestException('Some requisitions were not found, belong to another plant, or are already ordered');
      }
      const lines: LineInput[] = dto.lines.map((l) => {
        const r = byId.get(l.requisitionId)!;
        return { itemId: r.item_id, qty: Number(r.qty), unitPrice: l.unitPrice, taxCodeId: l.taxCodeId, requisitionId: r.id };
      });
      const poId = await this.build(em, s, dto.supplierId, dto.isSubcontract, undefined, lines);
      await this.mrp.markRequisitionsOrdered(em, reqIds);
      return poId;
    });
    return this.findOne(s.plantId, id);
  }

  list(plantId: string, filter: { status?: string; supplierId?: string }): Promise<PurchaseOrder[]> {
    const where: Record<string, unknown> = { plantId };
    if (filter.status) where.status = filter.status;
    if (filter.supplierId) where.supplierId = filter.supplierId;
    return this.db.getRepository(PurchaseOrder).find({ where, order: { createdAt: 'DESC' }, take: 500 });
  }

  async findOne(plantId: string, id: string): Promise<PurchaseOrder> {
    const po = await this.db.getRepository(PurchaseOrder).findOne({
      where: { id, plantId },
      relations: { lines: true },
      order: { lines: { lineNo: 'ASC' } },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  async approve(s: Scope, id: string): Promise<PurchaseOrder> {
    const repo = this.db.getRepository(PurchaseOrder);
    const po = await repo.findOne({ where: { id, plantId: s.plantId } });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status !== 'draft') throw new BadRequestException(`PO is '${po.status}', expected 'draft'`);
    po.status = 'approved';
    po.approvedBy = s.userId;
    po.updatedBy = s.userId;
    await repo.save(po);
    return this.findOne(s.plantId, id);
  }

  async send(s: Scope, id: string): Promise<PurchaseOrder> {
    const repo = this.db.getRepository(PurchaseOrder);
    const po = await repo.findOne({ where: { id, plantId: s.plantId } });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status !== 'approved') throw new BadRequestException(`PO is '${po.status}', expected 'approved'`);
    po.status = 'sent'; // (supplier email is stubbed)
    po.updatedBy = s.userId;
    await repo.save(po);
    return this.findOne(s.plantId, id);
  }

  // --- helpers -----------------------------------------------------------
  private async build(
    em: EntityManager,
    s: Scope,
    supplierId: string,
    isSubcontract: boolean | undefined,
    orderDate: string | undefined,
    lineInputs: LineInput[],
  ): Promise<string> {
    const rates = await this.taxRates(em, lineInputs);
    let subtotal = 0;
    let taxTotal = 0;
    const number = await this.docSeq.allocate(s.plantId, 'PO', em);
    const po = em.create(PurchaseOrder, {
      orgId: s.orgId,
      plantId: s.plantId,
      number,
      supplierId,
      status: 'draft',
      isSubcontract: isSubcontract ?? false,
      orderDate,
      createdBy: s.userId,
      updatedBy: s.userId,
    });
    await em.save(po);

    const lines = lineInputs.map((l, i) => {
      const lineTotal = Number(l.qty) * Number(l.unitPrice);
      const rate = (l.taxCodeId && rates.get(l.taxCodeId)) || 0;
      subtotal += lineTotal;
      taxTotal += (lineTotal * rate) / 100;
      return em.create(PoLine, {
        purchaseOrderId: po.id,
        lineNo: i + 1,
        itemId: l.itemId,
        qty: l.qty,
        qtyReceived: 0,
        unitPrice: l.unitPrice,
        taxCodeId: l.taxCodeId,
        requisitionId: l.requisitionId,
      });
    });
    await em.save(lines);

    po.subtotal = round2(subtotal);
    po.taxTotal = round2(taxTotal);
    po.grandTotal = round2(subtotal + taxTotal);
    await em.save(po);
    return po.id;
  }

  private async taxRates(em: EntityManager, lines: LineInput[]): Promise<Map<string, number>> {
    const ids = [...new Set(lines.map((l) => l.taxCodeId).filter(Boolean))] as string[];
    if (!ids.length) return new Map();
    const rows = (await em.query(`SELECT id, gst_rate FROM tax_code WHERE id = ANY($1)`, [ids])) as Array<{ id: string; gst_rate: string }>;
    return new Map(rows.map((r) => [r.id, Number(r.gst_rate)]));
  }
}
