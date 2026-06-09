import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { DocSequenceService } from '../doc-sequence/doc-sequence.service';
import { Invoice } from './invoice.entity';
import { InvoiceLine } from './invoice-line.entity';
import { GstTreatment } from '../../common/enums';
import { computeLineTax, resolveTreatment, round2Money as round2 } from '../../common/tax';
import { CreateInvoiceDto } from './dto';

interface Scope {
  orgId: string;
  plantId: string;
  userId: string;
}

interface LineInput {
  soLineId?: string;
  description: string;
  qty: number;
  unitPrice: number;
  hsnSac?: string;
  gstRate: number;
}

@Injectable()
export class InvoiceService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly docSeq: DocSequenceService,
  ) {}

  /** Tax invoice from a dispatched shipment (SM-164): lines from packing list, GST per place-of-supply. */
  async fromShipment(s: Scope, shipmentId: string): Promise<Invoice> {
    const id = await this.db.transaction(async (em) => {
      const head = (await em.query(
        `SELECT sh.sales_order_id, so.customer_id, c.state_code AS cust_state, p.state_code AS plant_state
           FROM shipment sh
           JOIN sales_order so ON so.id = sh.sales_order_id
           JOIN customer c ON c.id = so.customer_id
           JOIN plant p ON p.id = sh.plant_id
          WHERE sh.id = $1 AND sh.plant_id = $2`,
        [shipmentId, s.plantId],
      )) as Array<{ sales_order_id: string; customer_id: string; cust_state: string; plant_state: string }>;
      if (!head[0]) throw new NotFoundException('Shipment not found');

      const rows = (await em.query(
        `SELECT pl.qty, sl.id AS so_line_id, sl.part_name, sl.unit_price, tc.hsn_sac, COALESCE(tc.gst_rate, 0) AS gst_rate
           FROM packing_line pl JOIN so_line sl ON sl.id = pl.so_line_id LEFT JOIN tax_code tc ON tc.id = sl.tax_code_id
          WHERE pl.shipment_id = $1`,
        [shipmentId],
      )) as Array<{ qty: string; so_line_id: string; part_name: string; unit_price: string; hsn_sac: string | null; gst_rate: string }>;
      if (!rows.length) throw new BadRequestException('Shipment has no packed lines');

      const treatment = resolveTreatment(head[0].plant_state, head[0].cust_state);
      const lines: LineInput[] = rows.map((r) => ({ soLineId: r.so_line_id, description: r.part_name, qty: Number(r.qty), unitPrice: Number(r.unit_price), hsnSac: r.hsn_sac ?? undefined, gstRate: Number(r.gst_rate) }));
      return this.build(em, s, { customerId: head[0].customer_id, salesOrderId: head[0].sales_order_id, shipmentId, treatment, lines });
    });
    return this.findOne(s.plantId, id);
  }

  /** Direct invoice (SM-164). */
  async create(s: Scope, dto: CreateInvoiceDto): Promise<Invoice> {
    const id = await this.db.transaction(async (em) => {
      const c = (await em.query(`SELECT c.state_code AS cust_state, p.state_code AS plant_state FROM customer c, plant p WHERE c.id = $1 AND p.id = $2`, [dto.customerId, s.plantId])) as Array<{ cust_state: string; plant_state: string }>;
      if (!c[0]) throw new NotFoundException('Customer not found');
      const treatment = resolveTreatment(c[0].plant_state, c[0].cust_state);
      const lines: LineInput[] = dto.lines.map((l) => ({ soLineId: l.soLineId, description: l.description, qty: l.qty, unitPrice: l.unitPrice, hsnSac: l.hsnSac, gstRate: l.gstRate ?? 0 }));
      return this.build(em, s, { customerId: dto.customerId, salesOrderId: dto.salesOrderId, treatment, lines });
    });
    return this.findOne(s.plantId, id);
  }

  async issue(s: Scope, id: string): Promise<Invoice> {
    await this.db.transaction(async (em) => {
      const inv = await em.getRepository(Invoice).findOne({ where: { id, plantId: s.plantId } });
      if (!inv) throw new NotFoundException('Invoice not found');
      if (inv.status !== 'draft') throw new BadRequestException(`Invoice is '${inv.status}', expected 'draft'`);
      inv.status = 'issued';
      await em.save(inv);
      if (inv.salesOrderId) {
        await em.query(`UPDATE sales_order SET status = 'invoiced', updated_by = $2 WHERE id = $1 AND status IN ('dispatched', 'in_production', 'confirmed')`, [inv.salesOrderId, s.userId]);
      }
    });
    return this.findOne(s.plantId, id);
  }

  list(plantId: string, filter: { status?: string; customerId?: string }): Promise<Invoice[]> {
    const where: Record<string, unknown> = { plantId };
    if (filter.status) where.status = filter.status;
    if (filter.customerId) where.customerId = filter.customerId;
    return this.db.getRepository(Invoice).find({ where, order: { createdAt: 'DESC' }, take: 200 });
  }

  async findOne(plantId: string, id: string): Promise<Invoice> {
    const inv = await this.db.getRepository(Invoice).findOne({ where: { id, plantId }, relations: { lines: true }, order: { lines: { lineNo: 'ASC' } } });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  private async build(
    em: EntityManager,
    s: Scope,
    p: { customerId: string; salesOrderId?: string; shipmentId?: string; treatment: GstTreatment; lines: LineInput[] },
  ): Promise<string> {
    const number = await this.docSeq.allocate(s.plantId, 'INV', em);
    const inv = em.create(Invoice, {
      orgId: s.orgId,
      plantId: s.plantId,
      number,
      customerId: p.customerId,
      salesOrderId: p.salesOrderId,
      shipmentId: p.shipmentId,
      status: 'draft',
      gstTreatment: p.treatment,
      amountPaid: 0,
    });
    await em.save(inv);

    let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
    const lines = p.lines.map((l, i) => {
      const taxable = round2(l.qty * l.unitPrice);
      const t = computeLineTax(taxable, l.gstRate, p.treatment);
      subtotal += taxable; cgst += t.cgst; sgst += t.sgst; igst += t.igst;
      return em.create(InvoiceLine, { invoiceId: inv.id, lineNo: i + 1, soLineId: l.soLineId, description: l.description, hsnSac: l.hsnSac, qty: l.qty, unitPrice: l.unitPrice, taxableValue: taxable, gstRate: l.gstRate, taxAmount: t.total });
    });
    await em.save(lines);

    inv.subtotal = round2(subtotal);
    inv.cgst = round2(cgst);
    inv.sgst = round2(sgst);
    inv.igst = round2(igst);
    inv.grandTotal = round2(subtotal + cgst + sgst + igst);
    await em.save(inv);
    return inv.id;
  }
}
