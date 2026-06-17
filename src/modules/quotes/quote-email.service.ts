import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BlockedException } from '../../common/exceptions/blocked.exception';
import { MailService } from '../notifications/mail.service';
import { QuoteDocumentService } from './quote-document.service';
import { Quote } from './quote.entity';
import { QuoteStatus } from '../../common/enums';
import { SendQuoteEmailDto } from './dto/send-quote-email.dto';

interface Scope {
  orgId: string;
  plantId: string;
  userId: string;
}

/** Emails a quote (PDF attached) to the customer and records that it was sent. */
@Injectable()
export class QuoteEmailService {
  constructor(
    private readonly docs: QuoteDocumentService,
    private readonly mail: MailService,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

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

    const subject = dto.subject || `Quotation ${model.number}`;
    const body =
      dto.body ||
      `Dear ${model.buyer.name},\n\nPlease find attached our quotation ${model.number}.\n\nRegards,\n${model.seller.name}`;

    const result = await this.mail.send({
      orgId: s.orgId,
      to,
      subject,
      body,
      attachments: [{ filename: `${model.number}.pdf`, content: buffer, contentType: 'application/pdf' }],
    });

    // Record that the quote has been sent (draft → sent; no-op if already past draft).
    await this.db.getRepository(Quote).update(
      { id: quoteId, plantId: s.plantId, status: 'draft' as QuoteStatus },
      { status: 'sent', updatedBy: s.userId },
    );

    return { to, delivered: result.delivered, queued: result.queued };
  }
}
