import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { randomBytes } from 'crypto';
import { BlockedException } from '../../common/exceptions/blocked.exception';
import { QuoteFollowupKind, QuoteStatus } from '../../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { Customer } from '../customers/customer.entity';
import { Quote } from './quote.entity';
import { QuoteVersion } from './quote-version.entity';
import { QuoteFollowup } from './quote-followup.entity';
import { RecordQuoteResponseDto } from './dto/record-quote-response.dto';

const OPEN_STATUSES = ['sent', 'negotiating', 'draft'];

/** Records customer/internal responses against a quote and keeps the negotiation timeline. */
@Injectable()
export class QuoteResponseService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  /** Allocate (or reuse) the public response token used in the customer link. */
  async issueToken(plantId: string, quoteId: string): Promise<string> {
    const repo = this.db.getRepository(Quote);
    const quote = await repo.findOne({ where: { id: quoteId, plantId } });
    if (!quote) throw new NotFoundException('Quote not found');
    const token = randomBytes(24).toString('hex');
    await repo.update({ id: quoteId }, { responseToken: token });
    return token;
  }

  /** Record a 'sent' event on the timeline (called when the quote is emailed). */
  async logSent(plantId: string, quoteId: string, userId?: string): Promise<void> {
    const quote = await this.db.getRepository(Quote).findOne({ where: { id: quoteId, plantId } });
    if (!quote) return;
    const versionId = await this.currentVersionId(this.db.manager, quote.id, quote.currentVersion);
    await this.db.getRepository(QuoteFollowup).insert({
      quoteId: quote.id,
      quoteVersionId: versionId ?? undefined,
      kind: 'sent',
      source: 'internal',
      createdBy: userId,
    });
  }

  async timeline(plantId: string, quoteId: string): Promise<QuoteFollowup[]> {
    const quote = await this.db.getRepository(Quote).findOne({ where: { id: quoteId, plantId } });
    if (!quote) throw new NotFoundException('Quote not found');
    return this.db.getRepository(QuoteFollowup).find({ where: { quoteId }, order: { createdAt: 'ASC' } });
  }

  /** All quotes awaiting a customer response (sent/negotiating), with their latest response. */
  async followupList(plantId: string) {
    const quotes = await this.db.getRepository(Quote).find({
      where: { plantId, status: In(['sent', 'negotiating'] as QuoteStatus[]) },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    if (!quotes.length) return [];

    const ids = quotes.map((q) => q.id);
    const custIds = [...new Set(quotes.map((q) => q.customerId))];

    const followups = await this.db.getRepository(QuoteFollowup).find({
      where: { quoteId: In(ids) },
      order: { createdAt: 'DESC' },
    });
    const latest = new Map<string, QuoteFollowup>();
    const counts = new Map<string, number>();
    for (const f of followups) {
      counts.set(f.quoteId, (counts.get(f.quoteId) ?? 0) + 1);
      if (!latest.has(f.quoteId)) latest.set(f.quoteId, f); // DESC → first seen is the latest
    }

    const [customers, versions] = await Promise.all([
      this.db.getRepository(Customer).find({ where: { id: In(custIds) }, select: { id: true, name: true } }),
      this.db.getRepository(QuoteVersion).find({ where: { quoteId: In(ids), isCurrent: true } }),
    ]);
    const custName = new Map(customers.map((c) => [c.id, c.name]));
    const total = new Map(versions.map((v) => [v.quoteId, Number(v.grandTotal)]));

    const rows = quotes.map((q) => {
      const f = latest.get(q.id);
      return {
        id: q.id,
        number: q.number,
        customerId: q.customerId,
        customerName: custName.get(q.customerId) ?? '—',
        status: q.status,
        grandTotal: total.get(q.id) ?? 0,
        nextFollowUpDate: q.nextFollowUpDate ?? null,
        responseCount: counts.get(q.id) ?? 0,
        lastResponse: f
          ? { kind: f.kind, source: f.source, note: f.note ?? null, counterAmount: f.counterAmount != null ? Number(f.counterAmount) : null, createdAt: f.createdAt }
          : null,
      };
    });

    // Negotiating first, then those with a customer reply, then the rest.
    const weight = (r: (typeof rows)[number]) => (r.status === 'negotiating' ? 0 : r.lastResponse?.source === 'customer' ? 1 : 2);
    return rows.sort((a, b) => weight(a) - weight(b));
  }

  /** Internal user records a response (phone/email reply). */
  async recordInternal(plantId: string, quoteId: string, dto: RecordQuoteResponseDto, userId: string) {
    const quote = await this.db.getRepository(Quote).findOne({ where: { id: quoteId, plantId } });
    if (!quote) throw new NotFoundException('Quote not found');
    return this.record(quote, dto, 'internal', userId);
  }

  /** Core: log the response, move the quote status, set/clear the follow-up date, notify. */
  async record(quote: Quote, dto: RecordQuoteResponseDto, source: 'internal' | 'customer', userId?: string) {
    const changesStatus = dto.action === 'accept' || dto.action === 'reject' || dto.action === 'negotiate';
    if (changesStatus && !OPEN_STATUSES.includes(quote.status)) {
      throw new BlockedException('QUOTE_NOT_OPEN', `This quote is already ${quote.status} — it can't be responded to.`);
    }

    let newStatus: QuoteStatus | undefined;
    let nextFollowUp: string | null = quote.nextFollowUpDate ?? null;
    let followupKind: QuoteFollowupKind;

    switch (dto.action) {
      case 'accept': newStatus = 'accepted'; followupKind = 'accepted'; nextFollowUp = null; break;
      case 'reject': newStatus = 'rejected'; followupKind = 'rejected'; nextFollowUp = null; break;
      case 'negotiate': newStatus = 'negotiating'; followupKind = 'negotiating'; nextFollowUp = dto.nextFollowUpDate ?? nextFollowUp; break;
      case 'follow_up': followupKind = 'follow_up'; nextFollowUp = dto.nextFollowUpDate ?? nextFollowUp; break;
      default: followupKind = 'note'; break;
    }

    const currentVersionId = await this.currentVersionId(this.db.manager, quote.id, quote.currentVersion);

    await this.db.transaction(async (em) => {
      await em.getRepository(QuoteFollowup).insert({
        quoteId: quote.id,
        quoteVersionId: currentVersionId ?? undefined,
        kind: followupKind,
        source,
        note: dto.message,
        rejectReason: dto.rejectReason,
        counterAmount: dto.counterAmount,
        createdBy: userId,
      });
      await em.getRepository(Quote).update(
        { id: quote.id },
        { ...(newStatus ? { status: newStatus } : {}), nextFollowUpDate: nextFollowUp ?? undefined, updatedBy: userId ?? quote.updatedBy },
      );
    });

    if (source === 'customer') {
      const verb = dto.action === 'accept' ? 'accepted' : dto.action === 'reject' ? 'rejected' : 'responded to';
      await this.notifications.notifyOrg(quote.orgId, {
        type: 'quote_response',
        title: `Customer ${verb} ${quote.number}`,
        body: dto.counterAmount ? `Proposed ₹${dto.counterAmount}. ${dto.message ?? ''}`.trim() : dto.message,
        link: `/quotes/${quote.id}`,
      });
    }

    return { status: newStatus ?? quote.status, nextFollowUpDate: nextFollowUp };
  }

  private async currentVersionId(em: EntityManager, quoteId: string, versionNo: number): Promise<string | null> {
    const v = await em.getRepository(QuoteVersion).findOne({ where: { quoteId, versionNo } });
    return v?.id ?? null;
  }
}
