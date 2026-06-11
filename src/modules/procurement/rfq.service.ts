import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { round2Money as round2 } from '../../common/tax';
import { Rfq } from './rfq.entity';
import { RfqLine } from './rfq-line.entity';
import { RfqQuote } from './rfq-quote.entity';
import { DocSequenceService } from '../doc-sequence/doc-sequence.service';
import { PurchaseOrdersService } from './purchase-orders.service';

interface Scope { orgId: string; plantId: string; userId: string; }

export interface RfqLineRow { id: string; itemId: string; itemCode: string; itemName: string; qty: number; }
export interface RfqQuoteRow { id: string; rfqLineId: string; supplierId: string; supplier: string; unitPrice: number; leadDays: number | null; }

@Injectable()
export class RfqService {
  constructor(
    @InjectRepository(Rfq) private readonly rfq: Repository<Rfq>,
    @InjectRepository(RfqLine) private readonly lines: Repository<RfqLine>,
    @InjectRepository(RfqQuote) private readonly quotes: Repository<RfqQuote>,
    @InjectDataSource() private readonly db: DataSource,
    private readonly docSeq: DocSequenceService,
    private readonly pos: PurchaseOrdersService,
  ) {}

  async create(s: Scope, dto: { lines: Array<{ itemId: string; qty: number }>; notes?: string }): Promise<Rfq> {
    return this.db.transaction(async (em) => {
      const number = await this.docSeq.allocate(s.plantId, 'RFQ', em);
      const rfq = await em.save(em.create(Rfq, { orgId: s.orgId, plantId: s.plantId, number, notes: dto.notes, status: 'open' }));
      await em.save(dto.lines.map((l) => em.create(RfqLine, { rfqId: rfq.id, itemId: l.itemId, qty: l.qty })));
      return rfq;
    });
  }

  list(plantId: string) {
    return this.db.query(
      `SELECT r.id, r.number, r.status, r.notes, r.created_at AS "createdAt", COUNT(rl.id) AS "lineCount"
         FROM rfq r LEFT JOIN rfq_line rl ON rl.rfq_id = r.id
        WHERE r.plant_id = $1 GROUP BY r.id ORDER BY r.created_at DESC`,
      [plantId],
    );
  }

  async get(plantId: string, id: string) {
    const rfq = await this.rfq.findOne({ where: { id, plantId } });
    if (!rfq) throw new NotFoundException('RFQ not found');
    const lines = (await this.db.query(
      `SELECT rl.id, rl.item_id AS "itemId", i.code AS "itemCode", i.name AS "itemName", rl.qty
         FROM rfq_line rl JOIN item i ON i.id = rl.item_id WHERE rl.rfq_id = $1 ORDER BY i.code`,
      [id],
    )) as RfqLineRow[];
    const quotes = (await this.db.query(
      `SELECT q.id, q.rfq_line_id AS "rfqLineId", q.supplier_id AS "supplierId", s.name AS supplier,
              q.unit_price AS "unitPrice", q.lead_days AS "leadDays"
         FROM rfq_quote q JOIN supplier s ON s.id = q.supplier_id WHERE q.rfq_id = $1 ORDER BY q.unit_price`,
      [id],
    )) as RfqQuoteRow[];
    return { ...rfq, lines, quotes };
  }

  async addQuote(plantId: string, id: string, dto: { rfqLineId: string; supplierId: string; unitPrice: number; leadDays?: number }): Promise<RfqQuote> {
    const rfq = await this.rfq.findOne({ where: { id, plantId } });
    if (!rfq) throw new NotFoundException('RFQ not found');
    const line = await this.lines.findOne({ where: { id: dto.rfqLineId, rfqId: id } });
    if (!line) throw new BadRequestException('Line does not belong to this RFQ');
    return this.quotes.save(this.quotes.create({ rfqId: id, rfqLineId: dto.rfqLineId, supplierId: dto.supplierId, unitPrice: dto.unitPrice, leadDays: dto.leadDays }));
  }

  /** Per line, supplier quotes sorted by extended price with the cheapest flagged. */
  async compare(plantId: string, id: string) {
    const { lines, quotes } = await this.get(plantId, id);
    return lines.map((l) => {
      const lq = quotes
        .filter((q) => q.rfqLineId === l.id)
        .map((q) => ({ ...q, extended: round2(Number(q.unitPrice) * Number(l.qty)) }))
        .sort((a, b) => a.extended - b.extended);
      const bestSupplier = lq[0]?.supplierId ?? null;
      return { ...l, quotes: lq.map((q) => ({ ...q, best: q.supplierId === bestSupplier })) };
    });
  }

  /** Award the RFQ to a supplier → create a PO from that supplier's quoted lines. */
  async award(s: Scope, id: string, supplierId: string) {
    const rfq = await this.rfq.findOne({ where: { id, plantId: s.plantId } });
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.status === 'awarded') throw new BadRequestException('RFQ already awarded');
    const lines = (await this.db.query(
      `SELECT rl.item_id AS "itemId", rl.qty, q.unit_price AS "unitPrice"
         FROM rfq_line rl JOIN rfq_quote q ON q.rfq_line_id = rl.id AND q.supplier_id = $2
        WHERE rl.rfq_id = $1`,
      [id, supplierId],
    )) as Array<{ itemId: string; qty: string; unitPrice: string }>;
    if (!lines.length) throw new BadRequestException('Selected supplier has no quotes on this RFQ');
    const po = await this.pos.create(s, { supplierId, lines: lines.map((l) => ({ itemId: l.itemId, qty: Number(l.qty), unitPrice: Number(l.unitPrice) })) });
    rfq.status = 'awarded';
    await this.rfq.save(rfq);
    return po;
  }
}
