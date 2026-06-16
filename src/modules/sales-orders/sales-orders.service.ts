import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BlockedException } from '../../common/exceptions/blocked.exception';
import { Quote } from '../quotes/quote.entity';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { DocSequenceService } from '../doc-sequence/doc-sequence.service';
import { SalesOrder } from './sales-order.entity';
import { SoLine } from './so-line.entity';
import { SoStatus } from '../../common/enums';
import { CreateSalesOrderDto, FromQuoteDto, SoLineDto, SoStatusDto, UpdateSalesOrderDto } from './dto';
import { computeLineTax, resolveTreatment } from '../../common/tax';
import { rupeesInWords } from '../../common/amount-in-words';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

interface Scope {
  orgId: string;
  plantId: string;
  userId: string;
}

@Injectable()
export class SalesOrdersService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly docSeq: DocSequenceService,
  ) {}

  async create(s: Scope, dto: CreateSalesOrderDto): Promise<SalesOrder> {
    const id = await this.db.transaction(async (em) => {
      const number = await this.docSeq.allocate(s.plantId, 'SO', em);
      const so = em.create(SalesOrder, {
        orgId: s.orgId,
        plantId: s.plantId,
        number,
        customerId: dto.customerId,
        customerPoNumber: dto.customerPoNumber,
        vendorCode: dto.vendorCode,
        status: 'confirmed',
        orderDate: dto.orderDate,
        createdBy: s.userId,
        updatedBy: s.userId,
      });
      await em.save(so);
      await em.save(this.buildLines(em, so.id, dto.lines));
      return so.id;
    });
    return this.findOne(s.plantId, id);
  }

  /** One-click Quote → Sales Order (SM-120): carry pricing + lines, no re-keying. */
  async fromQuote(s: Scope, quoteVersionId: string, body: FromQuoteDto): Promise<SalesOrder> {
    const id = await this.db.transaction(async (em) => {
      const qv = (await em.query(
        `SELECT qv.id, qv.quote_id, q.customer_id
           FROM quote_version qv JOIN quote q ON q.id = qv.quote_id
          WHERE qv.id = $1 AND q.plant_id = $2`,
        [quoteVersionId, s.plantId],
      )) as Array<{ id: string; quote_id: string; customer_id: string }>;
      if (!qv[0]) throw new NotFoundException('Quote version not found');

      // Don't let the same quote version spawn a second sales order.
      const existing = await em.findOne(SalesOrder, {
        where: { quoteVersionId, plantId: s.plantId },
      });
      if (existing) {
        throw new BlockedException(
          'QUOTE_ALREADY_CONVERTED',
          `This quote is already on sales order ${existing.number} — open it instead of creating a duplicate.`,
          { label: `Open ${existing.number}`, link: `/sales-orders/${existing.id}` },
        );
      }

      const qLines = (await em.query(
        `SELECT id, part_name, primary_qty, unit_price, tax_code_id
           FROM quote_line WHERE quote_version_id = $1 ORDER BY line_no`,
        [quoteVersionId],
      )) as Array<{ id: string; part_name: string; primary_qty: string; unit_price: string; tax_code_id: string | null }>;
      if (!qLines.length) throw new BadRequestException('Quote version has no lines');

      // Carry the quote's project onto the sales order.
      const quote = await em.findOne(Quote, { where: { id: qv[0].quote_id } });

      const number = await this.docSeq.allocate(s.plantId, 'SO', em);
      const so = em.create(SalesOrder, {
        orgId: s.orgId,
        plantId: s.plantId,
        number,
        customerId: qv[0].customer_id,
        projectId: quote?.projectId,
        quoteVersionId,
        customerPoNumber: body.customerPoNumber,
        vendorCode: body.vendorCode,
        status: 'confirmed',
        createdBy: s.userId,
        updatedBy: s.userId,
      });
      await em.save(so);

      const lines = qLines.map((r, i) =>
        em.create(SoLine, {
          salesOrderId: so.id,
          lineNo: i + 1,
          quoteLineId: r.id,
          partName: r.part_name,
          qty: Number(r.primary_qty),
          unitPrice: Number(r.unit_price),
          taxCodeId: r.tax_code_id ?? undefined,
          status: 'open',
        }),
      );
      await em.save(lines);

      // mark the quote accepted (best-effort, same plant)
      await em.query(
        `UPDATE quote SET status = 'accepted', updated_by = $3
          WHERE id = $1 AND plant_id = $2 AND status IN ('draft', 'sent')`,
        [qv[0].quote_id, s.plantId, s.userId],
      );
      return so.id;
    });
    return this.findOne(s.plantId, id);
  }

  list(plantId: string, filter: { status?: string; customerId?: string }): Promise<SalesOrder[]> {
    const where: Record<string, unknown> = { plantId };
    if (filter.status) where.status = filter.status;
    if (filter.customerId) where.customerId = filter.customerId;
    return this.db.getRepository(SalesOrder).find({ where, order: { createdAt: 'DESC' }, take: 200 });
  }

  async findOne(plantId: string, id: string): Promise<SalesOrder> {
    const so = await this.db.getRepository(SalesOrder).findOne({
      where: { id, plantId },
      relations: { lines: true },
      order: { lines: { lineNo: 'ASC' } },
    });
    if (!so) throw new NotFoundException('Sales order not found');
    return so;
  }

  /** Printable sales-order document (seller/buyer + GST lines + totals). */
  async document(plantId: string, id: string): Promise<Record<string, unknown>> {
    const head = (await this.db.query(
      `SELECT so.number, so.order_date, so.status, so.customer_po_number, so.vendor_code,
              o.legal_name AS org_legal, o.name AS org_name,
              p.name AS plant_name, p.gstin AS plant_gstin, p.state_code AS plant_state, p.address AS plant_address,
              c.name AS cust_name, c.gstin AS cust_gstin, c.state_code AS cust_state, c.billing_address AS cust_address
         FROM sales_order so
         JOIN plant p ON p.id = so.plant_id
         JOIN org o ON o.id = p.org_id
         JOIN customer c ON c.id = so.customer_id
        WHERE so.id = $1 AND so.plant_id = $2`,
      [id, plantId],
    )) as Array<Record<string, unknown>>;
    if (!head[0]) throw new NotFoundException('Sales order not found');
    const h = head[0];

    const rawLines = (await this.db.query(
      `SELECT sl.line_no, sl.part_name, sl.qty, sl.unit_price, tc.hsn_sac, tc.gst_rate
         FROM so_line sl LEFT JOIN tax_code tc ON tc.id = sl.tax_code_id
        WHERE sl.sales_order_id = $1 ORDER BY sl.line_no`,
      [id],
    )) as Array<{ line_no: number; part_name: string; qty: string; unit_price: string; hsn_sac: string | null; gst_rate: string | null }>;

    const treatment = resolveTreatment(h.plant_state as string, h.cust_state as string);
    let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
    const lines = rawLines.map((l) => {
      const rate = l.gst_rate ? Number(l.gst_rate) : 0;
      const taxable = round2(Number(l.qty) * Number(l.unit_price));
      const t = computeLineTax(taxable, rate, treatment);
      subtotal += taxable; cgst += t.cgst; sgst += t.sgst; igst += t.igst;
      return {
        lineNo: l.line_no,
        description: l.part_name,
        hsnSac: l.hsn_sac ?? '',
        qty: Number(l.qty),
        unitPrice: Number(l.unit_price),
        taxableValue: taxable,
        gstRate: rate,
        cgst: t.cgst, sgst: t.sgst, igst: t.igst,
        amount: round2(taxable + t.total),
      };
    });
    const grandTotal = round2(subtotal + cgst + sgst + igst);

    return {
      title: 'SALES ORDER',
      seller: { name: (h.org_legal as string) || (h.org_name as string), plant: h.plant_name, gstin: h.plant_gstin, stateCode: h.plant_state, address: h.plant_address },
      buyer: { name: h.cust_name, gstin: h.cust_gstin, stateCode: h.cust_state, address: h.cust_address },
      so: { number: h.number, date: h.order_date, status: h.status, customerPo: h.customer_po_number ?? null, vendorCode: h.vendor_code ?? null, gstTreatment: treatment },
      lines,
      totals: {
        subtotal: round2(subtotal), cgst: round2(cgst), sgst: round2(sgst), igst: round2(igst),
        taxTotal: round2(cgst + sgst + igst), grandTotal,
      },
      amountInWords: rupeesInWords(grandTotal),
    };
  }

  async update(s: Scope, id: string, dto: UpdateSalesOrderDto): Promise<SalesOrder> {
    const { taxCodeId, ...header } = dto;
    const so = await this.findOne(s.plantId, id);
    Object.assign(so, header, { updatedBy: s.userId });
    await this.db.getRepository(SalesOrder).save(so);
    if (taxCodeId !== undefined) {
      await this.db.query(`UPDATE so_line SET tax_code_id = $1 WHERE sales_order_id = $2`, [taxCodeId || null, id]);
    }
    return this.findOne(s.plantId, id);
  }

  async setStatus(s: Scope, id: string, dto: SoStatusDto): Promise<SalesOrder> {
    const repo = this.db.getRepository(SalesOrder);
    const so = await repo.findOne({ where: { id, plantId: s.plantId } });
    if (!so) throw new NotFoundException('Sales order not found');
    this.assertTransition(so.status, dto.status);
    so.status = dto.status;
    so.updatedBy = s.userId;
    await repo.save(so);
    return this.findOne(s.plantId, id);
  }

  // --- helpers -----------------------------------------------------------
  private buildLines(em: EntityManager, salesOrderId: string, lines: SoLineDto[]): SoLine[] {
    return lines.map((line, i) =>
      em.create(SoLine, { ...line, salesOrderId, lineNo: i + 1, status: 'open' }),
    );
  }

  private static readonly ALLOWED: Record<SoStatus, SoStatus[]> = {
    confirmed: ['in_production', 'cancelled'],
    in_production: ['dispatched', 'cancelled'],
    dispatched: ['invoiced'],
    invoiced: ['closed'],
    closed: [],
    cancelled: [],
  };

  private assertTransition(from: SoStatus, to: SoStatus): void {
    if (!SalesOrdersService.ALLOWED[from]?.includes(to)) {
      throw new BadRequestException(`Cannot move sales order from '${from}' to '${to}'`);
    }
  }
}
