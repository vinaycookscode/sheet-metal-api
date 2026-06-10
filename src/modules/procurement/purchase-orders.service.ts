import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { DocSequenceService } from '../doc-sequence/doc-sequence.service';
import { MrpService } from '../planning/mrp.service';
import { PurchaseOrder } from './purchase-order.entity';
import { PoLine } from './po-line.entity';
import { CreatePurchaseOrderDto, FromRequisitionsDto } from './dto';
import { computeLineTax, resolveTreatment } from '../../common/tax';
import { rupeesInWords } from '../../common/amount-in-words';
import { NotificationsService } from '../notifications/notifications.service';

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
    private readonly notifications: NotificationsService,
  ) {}

  private async notifyCreated(s: Scope, po: PurchaseOrder): Promise<PurchaseOrder> {
    await this.notifications.notifyOrg(s.orgId, {
      type: 'po_approval',
      title: `PO ${po.number} awaiting approval`,
      link: '/purchase-orders',
      email: true,
    });
    return po;
  }

  async create(s: Scope, dto: CreatePurchaseOrderDto): Promise<PurchaseOrder> {
    const id = await this.db.transaction(async (em) => this.build(em, s, dto.supplierId, dto.isSubcontract, dto.orderDate, dto.lines));
    return this.notifyCreated(s, await this.findOne(s.plantId, id));
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
    return this.notifyCreated(s, await this.findOne(s.plantId, id));
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

  /** Full print-ready purchase order: buyer (us), supplier, lines (GST split), totals, amount in words. */
  async document(plantId: string, id: string): Promise<Record<string, unknown>> {
    const po = await this.findOne(plantId, id);
    const head = (await this.db.query(
      `SELECT po.number, po.order_date, po.status,
              o.legal_name AS org_legal, o.name AS org_name,
              p.name AS plant_name, p.gstin AS plant_gstin, p.state_code AS plant_state, p.address AS plant_address,
              s.name AS sup_name, s.code AS sup_code, s.gstin AS sup_gstin, s.state_code AS sup_state
         FROM purchase_order po
         JOIN plant p ON p.id = po.plant_id
         JOIN org o ON o.id = p.org_id
         JOIN supplier s ON s.id = po.supplier_id
        WHERE po.id = $1 AND po.plant_id = $2`,
      [id, plantId],
    )) as Array<Record<string, unknown>>;
    const h = head[0] ?? {};

    const itemIds = [...new Set(po.lines.map((l) => l.itemId))];
    const taxIds = [...new Set(po.lines.map((l) => l.taxCodeId).filter(Boolean))] as string[];
    const items = itemIds.length ? ((await this.db.query(`SELECT id, code, name FROM item WHERE id = ANY($1)`, [itemIds])) as Array<{ id: string; code: string; name: string }>) : [];
    const taxes = taxIds.length ? ((await this.db.query(`SELECT id, hsn_sac, gst_rate FROM tax_code WHERE id = ANY($1)`, [taxIds])) as Array<{ id: string; hsn_sac: string; gst_rate: string }>) : [];
    const itemById = new Map(items.map((i) => [i.id, i]));
    const taxById = new Map(taxes.map((t) => [t.id, t]));

    const treatment = resolveTreatment(h.plant_state as string, h.sup_state as string);
    let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
    const lines = po.lines.map((l) => {
      const it = itemById.get(l.itemId);
      const tc = l.taxCodeId ? taxById.get(l.taxCodeId) : undefined;
      const rate = tc ? Number(tc.gst_rate) : 0;
      const taxable = round2(Number(l.qty) * Number(l.unitPrice));
      const t = computeLineTax(taxable, rate, treatment);
      subtotal += taxable; cgst += t.cgst; sgst += t.sgst; igst += t.igst;
      return {
        lineNo: l.lineNo,
        description: it ? `${it.code} — ${it.name}` : 'Item',
        hsnSac: tc?.hsn_sac ?? '',
        qty: Number(l.qty),
        unitPrice: Number(l.unitPrice),
        taxableValue: taxable,
        gstRate: rate,
        cgst: t.cgst, sgst: t.sgst, igst: t.igst,
        amount: round2(taxable + t.total),
      };
    });
    const grandTotal = round2(subtotal + cgst + sgst + igst);

    return {
      title: 'PURCHASE ORDER',
      buyer: { name: (h.org_legal as string) || (h.org_name as string), plant: h.plant_name, gstin: h.plant_gstin, stateCode: h.plant_state, address: h.plant_address },
      supplier: { name: h.sup_name, code: h.sup_code, gstin: h.sup_gstin, stateCode: h.sup_state },
      po: { number: h.number, date: h.order_date, status: h.status, gstTreatment: treatment },
      lines,
      totals: {
        subtotal: round2(subtotal), cgst: round2(cgst), sgst: round2(sgst), igst: round2(igst),
        taxTotal: round2(cgst + sgst + igst), grandTotal,
      },
      amountInWords: rupeesInWords(grandTotal),
    };
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
    // Default each line to the org's primary HSN/GST code when none was chosen,
    // so the purchase order carries a real GST rate (overridable via the line's taxCodeId).
    const defTax = (await em.query(`SELECT id FROM tax_code ORDER BY hsn_sac LIMIT 1`)) as Array<{ id: string }>;
    const defaultTaxCodeId = defTax[0]?.id;
    const effInputs = lineInputs.map((l) => ({ ...l, taxCodeId: l.taxCodeId ?? defaultTaxCodeId }));
    const rates = await this.taxRates(em, effInputs);
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

    const lines = effInputs.map((l, i) => {
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
