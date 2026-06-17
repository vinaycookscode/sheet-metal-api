import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { BlockedException } from '../../common/exceptions/blocked.exception';
import { MailService } from '../notifications/mail.service';
import { QuoteDocumentService } from './quote-document.service';
import { QuoteResponseService } from './quote-response.service';
import { Quote } from './quote.entity';
import { QuoteStatus } from '../../common/enums';
import { SendQuoteEmailDto } from './dto/send-quote-email.dto';

interface Scope {
  orgId: string;
  plantId: string;
  userId: string;
}

/** Emails a quote (PDF attached + a customer response link) and records that it was sent. */
@Injectable()
export class QuoteEmailService {
  private readonly webUrl: string;

  constructor(
    private readonly docs: QuoteDocumentService,
    private readonly mail: MailService,
    private readonly responses: QuoteResponseService,
    private readonly config: ConfigService,
    @InjectDataSource() private readonly db: DataSource,
  ) {
    this.webUrl = (this.config.get<string>('PUBLIC_WEB_URL') ?? 'http://localhost:4200').replace(/\/$/, '');
  }

  async send(s: Scope, quoteId: string, dto: SendQuoteEmailDto) {
    const { buffer, model } = await this.docs.renderPdf(s.plantId, quoteId);

    const to = dto.to || model.buyer.email;
    if (!to) {
      throw new BlockedException(
        'NO_CUSTOMER_EMAIL',
        'This customer has no email address — add one on the customer record, or type a recipient.',
        { label: 'Open customers', link: '/customers' },
      );
    }

    // Public, unguessable link the customer uses to accept / reject / counter.
    const token = await this.responses.issueToken(s.plantId, quoteId);
    const link = `${this.webUrl}/quote-response/${token}`;

    const subject = dto.subject || `Quotation ${model.number}`;
    const intro =
      dto.body ||
      `Dear ${model.buyer.name},\n\nPlease find attached our quotation ${model.number}.\n\nRegards,\n${model.seller.name}`;
    const body = `${intro}\n\nView & respond to your quotation: ${link}`;
    const html = `<p>${intro.replace(/\n/g, '<br>')}</p><p><a href="${link}">View &amp; respond to your quotation</a></p>`;

    const result = await this.mail.send({
      orgId: s.orgId,
      to,
      subject,
      body,
      html,
      attachments: [{ filename: `${model.number}.pdf`, content: buffer, contentType: 'application/pdf' }],
    });

    // Record that the quote has been sent (draft/negotiating → sent) + log the event.
    await this.db.getRepository(Quote).update(
      { id: quoteId, plantId: s.plantId, status: In(['draft', 'negotiating'] as QuoteStatus[]) },
      { status: 'sent', updatedBy: s.userId },
    );
    await this.responses.logSent(s.plantId, quoteId, s.userId);

    return { to, delivered: result.delivered, queued: result.queued, link };
  }
}
