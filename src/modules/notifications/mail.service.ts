import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { EmailOutbox } from './email-outbox.entity';

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendMailInput {
  orgId: string;
  to: string;
  subject: string;
  body: string;
  html?: string;
  attachments?: MailAttachment[];
}

export interface SendMailResult {
  /** True only when actually delivered via SMTP. */
  delivered: boolean;
  /** True when SMTP isn't configured and the mail is parked in the outbox. */
  queued: boolean;
  outboxId: string;
}

/**
 * Sends transactional email via SMTP (works with any SMTP host, incl. Resend's SMTP).
 * Every message is recorded in email_outbox first, then delivered when SMTP is
 * configured (MAIL_HOST set); otherwise it stays queued so nothing is lost and the
 * app keeps working without credentials. Config via env:
 *   MAIL_HOST, MAIL_PORT (587), MAIL_SECURE (false), MAIL_USER, MAIL_PASS, MAIL_FROM
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter?: nodemailer.Transporter;
  private readonly from: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(EmailOutbox) private readonly outbox: Repository<EmailOutbox>,
  ) {
    this.from = this.config.get<string>('MAIL_FROM') ?? 'no-reply@sheetmetal.local';
    const host = this.config.get<string>('MAIL_HOST');
    if (host) {
      const user = this.config.get<string>('MAIL_USER');
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get('MAIL_PORT') ?? 587),
        secure: String(this.config.get('MAIL_SECURE')) === 'true',
        auth: user ? { user, pass: this.config.get<string>('MAIL_PASS') } : undefined,
      });
      this.logger.log(`SMTP configured (${host})`);
    } else {
      this.logger.warn('SMTP not configured (MAIL_HOST unset) — emails will be queued only');
    }
  }

  get configured(): boolean {
    return !!this.transporter;
  }

  async send(input: SendMailInput): Promise<SendMailResult> {
    const row = await this.outbox.save(
      this.outbox.create({ orgId: input.orgId, toEmail: input.to, subject: input.subject, body: input.body, status: 'pending' }),
    );

    if (!this.transporter) {
      this.logger.warn(`queued (no SMTP) #${row.id} → ${input.to}`);
      return { delivered: false, queued: true, outboxId: row.id };
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: input.to,
        subject: input.subject,
        text: input.body,
        html: input.html,
        attachments: input.attachments,
      });
      await this.outbox.update({ id: row.id }, { status: 'sent', sentAt: new Date() });
      this.logger.log(`mail sent #${row.id} → ${input.to}`);
      return { delivered: true, queued: false, outboxId: row.id };
    } catch (e) {
      const error = (e as Error).message;
      await this.outbox.update({ id: row.id }, { status: 'error', error });
      this.logger.error(`mail failed #${row.id} → ${input.to}: ${error}`);
      throw e;
    }
  }
}
