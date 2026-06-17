import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockedException } from '../../common/exceptions/blocked.exception';
import { Quote } from '../quotes/quote.entity';
import { QuoteDocumentService } from '../quotes/quote-document.service';
import { QuoteResponseService } from '../quotes/quote-response.service';
import { PublicRespondDto } from './dto/public-respond.dto';

const RESPONDABLE = ['sent', 'negotiating'];

/** Customer-facing quote access via an unguessable token (no login). */
@Injectable()
export class PublicQuoteService {
  constructor(
    @InjectRepository(Quote) private readonly quotes: Repository<Quote>,
    private readonly docs: QuoteDocumentService,
    private readonly responses: QuoteResponseService,
  ) {}

  private async byToken(token: string): Promise<Quote> {
    const quote = token ? await this.quotes.findOne({ where: { responseToken: token } }) : null;
    if (!quote) throw new NotFoundException('This quotation link is invalid or has expired.');
    return quote;
  }

  /** Customer-safe view (prices only — never costs/margins) + whether a response is still open. */
  async view(token: string) {
    const quote = await this.byToken(token);
    const model = await this.docs.model(quote.plantId, quote.id);
    return { ...model, status: quote.status, canRespond: RESPONDABLE.includes(quote.status) };
  }

  async respond(token: string, dto: PublicRespondDto) {
    const quote = await this.byToken(token);
    if (!RESPONDABLE.includes(quote.status)) {
      throw new BlockedException('QUOTE_NOT_OPEN', `This quotation has already been ${quote.status}.`);
    }
    await this.responses.record(
      quote,
      { action: dto.action, rejectReason: dto.rejectReason, counterAmount: dto.counterAmount, message: dto.message },
      'customer',
    );
    const status = dto.action === 'accept' ? 'accepted' : dto.action === 'reject' ? 'rejected' : 'negotiating';
    return { ok: true, status };
  }
}
