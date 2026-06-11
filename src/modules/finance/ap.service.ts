import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { round2Money as round2 } from '../../common/tax';
import { SupplierInvoice } from './supplier-invoice.entity';
import { VendorPayment } from './vendor-payment.entity';

interface Scope { orgId: string; plantId: string; userId: string; }

@Injectable()
export class ApService {
  constructor(
    @InjectRepository(SupplierInvoice) private readonly inv: Repository<SupplierInvoice>,
    @InjectRepository(VendorPayment) private readonly pay: Repository<VendorPayment>,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  /** Capture a vendor bill against a PO (defaults amounts from the PO totals). */
  async createFromPo(s: Scope, poId: string, dto: { supplierRef?: string; invoiceDate?: string }): Promise<SupplierInvoice> {
    const po = (await this.db.query(
      `SELECT org_id, plant_id, supplier_id, subtotal, tax_total, grand_total FROM purchase_order WHERE id = $1 AND plant_id = $2`,
      [poId, s.plantId],
    )) as Array<{ org_id: string; plant_id: string; supplier_id: string; subtotal: string; tax_total: string; grand_total: string }>;
    if (!po[0]) throw new NotFoundException('Purchase order not found');
    const si = this.inv.create({
      orgId: po[0].org_id,
      plantId: po[0].plant_id,
      supplierId: po[0].supplier_id,
      purchaseOrderId: poId,
      supplierRef: dto.supplierRef,
      invoiceDate: dto.invoiceDate,
      subtotal: Number(po[0].subtotal),
      taxTotal: Number(po[0].tax_total),
      grandTotal: Number(po[0].grand_total),
    });
    return this.inv.save(si);
  }

  list(plantId: string) {
    return this.db.query(
      `SELECT si.id, si.supplier_ref AS "supplierRef", si.invoice_date AS "invoiceDate",
              si.subtotal, si.tax_total AS "taxTotal", si.grand_total AS "grandTotal", si.amount_paid AS "amountPaid",
              si.match_status AS "matchStatus", si.status, s.name AS supplier, po.number AS "poNumber"
         FROM supplier_invoice si
         JOIN supplier s ON s.id = si.supplier_id
         LEFT JOIN purchase_order po ON po.id = si.purchase_order_id
        WHERE si.plant_id = $1
        ORDER BY si.created_at DESC`,
      [plantId],
    );
  }

  async findOne(plantId: string, id: string): Promise<SupplierInvoice> {
    const si = await this.inv.findOne({ where: { id, plantId } });
    if (!si) throw new NotFoundException('Supplier invoice not found');
    return si;
  }

  /** 3-way match: invoice total vs GRN-received value (qty_received × PO unit price + tax). */
  async match(plantId: string, id: string) {
    const si = await this.findOne(plantId, id);
    if (!si.purchaseOrderId) throw new BadRequestException('No PO linked to this invoice');
    const r = (await this.db.query(
      `SELECT COALESCE(SUM(pl.qty_received * pl.unit_price), 0) AS sub,
              COALESCE(SUM(pl.qty_received * pl.unit_price * COALESCE(tc.gst_rate, 0) / 100), 0) AS tax
         FROM po_line pl LEFT JOIN tax_code tc ON tc.id = pl.tax_code_id
        WHERE pl.purchase_order_id = $1`,
      [si.purchaseOrderId],
    )) as Array<{ sub: string; tax: string }>;
    const received = round2(Number(r[0].sub) + Number(r[0].tax));
    const invoiced = Number(si.grandTotal);
    const tolerance = Math.max(1, invoiced * 0.02); // ±2% (min ₹1)
    si.matchStatus = Math.abs(received - invoiced) <= tolerance ? 'matched' : 'variance';
    await this.inv.save(si);
    return { receivedValue: received, invoicedValue: invoiced, variance: round2(invoiced - received), matchStatus: si.matchStatus };
  }

  async approve(plantId: string, id: string): Promise<SupplierInvoice> {
    const si = await this.findOne(plantId, id);
    if (si.status !== 'draft') throw new BadRequestException(`Invoice is '${si.status}', expected 'draft'`);
    si.status = 'approved';
    return this.inv.save(si);
  }

  async recordPayment(s: Scope, dto: { supplierInvoiceId?: string; supplierId?: string; amount: number; method?: string; reference?: string }): Promise<VendorPayment> {
    let si: SupplierInvoice | null = null;
    if (dto.supplierInvoiceId) si = await this.findOne(s.plantId, dto.supplierInvoiceId);
    const supplierId = si?.supplierId ?? dto.supplierId;
    if (!supplierId) throw new BadRequestException('supplierId or supplierInvoiceId is required');
    const vp = await this.pay.save(
      this.pay.create({ orgId: s.orgId, plantId: s.plantId, supplierId, supplierInvoiceId: dto.supplierInvoiceId, amount: dto.amount, method: dto.method, reference: dto.reference }),
    );
    if (si) {
      si.amountPaid = round2(Number(si.amountPaid) + dto.amount);
      si.status = si.amountPaid >= Number(si.grandTotal) - 0.001 ? 'paid' : 'partially_paid';
      await this.inv.save(si);
    }
    return vp;
  }

  async apAging(plantId: string) {
    const rows = (await this.db.query(
      `SELECT si.id, si.supplier_ref AS "ref", s.name AS supplier, si.invoice_date AS "invoiceDate",
              (si.grand_total - si.amount_paid) AS outstanding, (CURRENT_DATE - si.invoice_date) AS "ageDays"
         FROM supplier_invoice si JOIN supplier s ON s.id = si.supplier_id
        WHERE si.plant_id = $1 AND si.status IN ('approved','partially_paid') AND (si.grand_total - si.amount_paid) > 0
        ORDER BY si.invoice_date`,
      [plantId],
    )) as Array<{ id: string; ref: string; supplier: string; invoiceDate: string; outstanding: string; ageDays: number }>;
    const buckets = { current: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
    let total = 0;
    const invoices = rows.map((r) => {
      const out = Number(r.outstanding);
      total += out;
      const age = Number(r.ageDays);
      const bucket = age <= 30 ? 'current' : age <= 60 ? 'd31_60' : age <= 90 ? 'd61_90' : 'd90plus';
      buckets[bucket] += out;
      return { supplierInvoice: r.ref ?? '(no ref)', supplier: r.supplier, invoiceDate: r.invoiceDate, outstanding: round2(out), ageDays: age, bucket };
    });
    return {
      totalOutstanding: round2(total),
      buckets: { current: round2(buckets.current), d31_60: round2(buckets.d31_60), d61_90: round2(buckets.d61_90), d90plus: round2(buckets.d90plus) },
      invoices,
    };
  }
}
