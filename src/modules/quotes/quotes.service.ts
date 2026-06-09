import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { DocSequenceService } from '../doc-sequence/doc-sequence.service';
import { Quote } from './quote.entity';
import { QuoteVersion } from './quote-version.entity';
import { QuoteLine } from './quote-line.entity';
import { EstimateDetail } from './estimate-detail.entity';
import { QuoteStatus } from '../../common/enums';
import { CreateQuoteDto, QuoteLineInputDto, QuoteStatusDto, ReviseQuoteDto } from './dto';

interface Scope {
  orgId: string;
  plantId: string;
  userId: string;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

@Injectable()
export class QuotesService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly docSeq: DocSequenceService,
  ) {}

  async create(s: Scope, dto: CreateQuoteDto): Promise<Quote> {
    if (!dto.customerId && !dto.inquiryId) {
      throw new BadRequestException('Provide customerId or inquiryId');
    }
    const id = await this.db.transaction(async (em) => {
      let customerId = dto.customerId;
      let lines = dto.lines;

      // Derive customer / lines from the inquiry when not given explicitly.
      if (dto.inquiryId) {
        const inq = (await em.query(
          `SELECT customer_id FROM inquiry WHERE id = $1 AND plant_id = $2`,
          [dto.inquiryId, s.plantId],
        )) as Array<{ customer_id: string }>;
        if (!inq[0]) throw new NotFoundException('Inquiry not found');
        customerId = customerId ?? inq[0].customer_id;
        if (!lines || lines.length === 0) {
          const il = (await em.query(
            `SELECT id, part_name, qty, target_price FROM inquiry_line WHERE inquiry_id = $1 ORDER BY line_no`,
            [dto.inquiryId],
          )) as Array<{ id: string; part_name: string; qty: string; target_price: string | null }>;
          lines = il.map((r) => ({
            partName: r.part_name,
            primaryQty: Number(r.qty),
            unitPrice: Number(r.target_price ?? 0),
            inquiryLineId: r.id,
          }));
        }
      }
      if (!customerId) throw new BadRequestException('customerId could not be resolved');
      if (!lines || lines.length === 0) throw new BadRequestException('Quote needs at least one line');

      const number = await this.docSeq.allocate(s.plantId, 'QT', em);
      const quote = em.create(Quote, {
        orgId: s.orgId,
        plantId: s.plantId,
        number,
        inquiryId: dto.inquiryId,
        customerId,
        currentVersion: 1,
        status: 'draft',
        createdBy: s.userId,
        updatedBy: s.userId,
      });
      await em.save(quote);
      await this.buildVersion(em, quote.id, 1, dto, lines, true);

      // mark the originating inquiry as quoted (best-effort, same plant)
      if (dto.inquiryId) {
        await em.query(
          `UPDATE inquiry SET status = 'quoted', updated_by = $3
            WHERE id = $1 AND plant_id = $2 AND status IN ('new', 'estimating')`,
          [dto.inquiryId, s.plantId, s.userId],
        );
      }
      return quote.id;
    });
    return this.findOne(s.plantId, id);
  }

  list(plantId: string, filter: { status?: string; customerId?: string }): Promise<Quote[]> {
    const where: Record<string, unknown> = { plantId };
    if (filter.status) where.status = filter.status;
    if (filter.customerId) where.customerId = filter.customerId;
    return this.db.getRepository(Quote).find({ where, order: { createdAt: 'DESC' }, take: 200 });
  }

  async findOne(plantId: string, id: string, em?: EntityManager): Promise<Quote> {
    const repo = (em ?? this.db).getRepository(Quote);
    const quote = await repo.findOne({
      where: { id, plantId },
      relations: { versions: { lines: { estimateDetails: true } } },
      order: { versions: { versionNo: 'ASC', lines: { lineNo: 'ASC' } } },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  async revise(s: Scope, id: string, dto: ReviseQuoteDto): Promise<Quote> {
    await this.db.transaction(async (em) => {
      const quote = await em.getRepository(Quote).findOne({ where: { id, plantId: s.plantId } });
      if (!quote) throw new NotFoundException('Quote not found');

      const current = await em.getRepository(QuoteVersion).findOne({
        where: { quoteId: id, versionNo: quote.currentVersion },
        relations: { lines: { estimateDetails: true } },
        order: { lines: { lineNo: 'ASC' } },
      });

      const lines: QuoteLineInputDto[] =
        dto.lines && dto.lines.length ? dto.lines : (current?.lines ?? []).map(lineToInput);
      if (!lines.length) throw new BadRequestException('Quote needs at least one line');

      const header = {
        validUntil: dto.validUntil ?? current?.validUntil,
        leadTimeDays: dto.leadTimeDays ?? current?.leadTimeDays,
        markupPct: dto.markupPct ?? current?.markupPct,
        terms: dto.terms ?? current?.terms,
      };

      const newVersionNo = quote.currentVersion + 1;
      await em.update(QuoteVersion, { quoteId: id }, { isCurrent: false });
      await this.buildVersion(em, id, newVersionNo, header, lines, true);
      await em.update(Quote, { id }, { currentVersion: newVersionNo, status: 'draft', updatedBy: s.userId });
    });
    return this.findOne(s.plantId, id);
  }

  async setStatus(s: Scope, id: string, dto: QuoteStatusDto): Promise<Quote> {
    const repo = this.db.getRepository(Quote);
    const quote = await repo.findOne({ where: { id, plantId: s.plantId } });
    if (!quote) throw new NotFoundException('Quote not found');
    this.assertTransition(quote.status, dto.status);
    quote.status = dto.status;
    if (dto.winLossReason) quote.winLossReason = dto.winLossReason;
    quote.updatedBy = s.userId;
    await repo.save(quote);
    return this.findOne(s.plantId, id);
  }

  // --- helpers -----------------------------------------------------------
  private async buildVersion(
    em: EntityManager,
    quoteId: string,
    versionNo: number,
    header: { validUntil?: string; leadTimeDays?: number; markupPct?: number; terms?: string },
    lines: QuoteLineInputDto[],
    isCurrent: boolean,
  ): Promise<QuoteVersion> {
    const taxRates = await this.taxRates(em, lines);

    let subtotal = 0;
    let taxTotal = 0;
    const builtLines = lines.map((l, i) => {
      const lineSubtotal = Number(l.primaryQty) * Number(l.unitPrice);
      const totalCost =
        Number(l.materialCost ?? 0) + Number(l.processCost ?? 0) + Number(l.hardwareCost ?? 0) +
        Number(l.outsideCost ?? 0) + Number(l.setupCost ?? 0);
      const marginPct =
        Number(l.unitPrice) > 0 ? round2(((Number(l.unitPrice) - totalCost) / Number(l.unitPrice)) * 100) : undefined;
      const rate = (l.taxCodeId && taxRates.get(l.taxCodeId)) || 0;
      subtotal += lineSubtotal;
      taxTotal += (lineSubtotal * rate) / 100;

      return em.create(QuoteLine, {
        lineNo: i + 1,
        inquiryLineId: l.inquiryLineId,
        partName: l.partName,
        primaryQty: l.primaryQty,
        unitPrice: l.unitPrice,
        qtyBreakPrices: l.qtyBreakPrices,
        materialCost: l.materialCost ?? 0,
        processCost: l.processCost ?? 0,
        hardwareCost: l.hardwareCost ?? 0,
        outsideCost: l.outsideCost ?? 0,
        setupCost: l.setupCost ?? 0,
        marginPct,
        taxCodeId: l.taxCodeId,
        estimateDetails: (l.estimateDetails ?? []).map((d) => em.create(EstimateDetail, { ...d })),
      });
    });

    const version = em.create(QuoteVersion, {
      quoteId,
      versionNo,
      validUntil: header.validUntil,
      leadTimeDays: header.leadTimeDays,
      markupPct: header.markupPct,
      terms: header.terms,
      subtotal: round2(subtotal),
      taxTotal: round2(taxTotal),
      grandTotal: round2(subtotal + taxTotal),
      isCurrent,
      lines: builtLines,
    });
    return em.save(version);
  }

  private async taxRates(em: EntityManager, lines: QuoteLineInputDto[]): Promise<Map<string, number>> {
    const ids = [...new Set(lines.map((l) => l.taxCodeId).filter(Boolean))] as string[];
    if (!ids.length) return new Map();
    const rows = (await em.query(`SELECT id, gst_rate FROM tax_code WHERE id = ANY($1)`, [ids])) as Array<{
      id: string;
      gst_rate: string;
    }>;
    return new Map(rows.map((r) => [r.id, Number(r.gst_rate)]));
  }

  private static readonly ALLOWED: Record<QuoteStatus, QuoteStatus[]> = {
    draft: ['sent', 'expired'],
    sent: ['accepted', 'rejected', 'expired'],
    accepted: [],
    rejected: [],
    expired: ['sent'],
  };

  private assertTransition(from: QuoteStatus, to: QuoteStatus): void {
    if (!QuotesService.ALLOWED[from]?.includes(to)) {
      throw new BadRequestException(`Cannot move quote from '${from}' to '${to}'`);
    }
  }
}

function lineToInput(l: QuoteLine): QuoteLineInputDto {
  return {
    partName: l.partName,
    primaryQty: Number(l.primaryQty),
    unitPrice: Number(l.unitPrice),
    qtyBreakPrices: l.qtyBreakPrices,
    materialCost: Number(l.materialCost),
    processCost: Number(l.processCost),
    hardwareCost: Number(l.hardwareCost),
    outsideCost: Number(l.outsideCost),
    setupCost: Number(l.setupCost),
    taxCodeId: l.taxCodeId,
    inquiryLineId: l.inquiryLineId,
    estimateDetails: (l.estimateDetails ?? []).map((d) => ({
      detailType: d.detailType,
      refId: d.refId,
      description: d.description,
      qty: d.qty != null ? Number(d.qty) : undefined,
      rate: d.rate != null ? Number(d.rate) : undefined,
      yieldPct: d.yieldPct != null ? Number(d.yieldPct) : undefined,
      amount: Number(d.amount),
    })),
  };
}
