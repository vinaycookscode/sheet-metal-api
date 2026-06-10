import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { EmailOutbox } from './email-outbox.entity';

export interface NotifyPayload {
  type: string;
  title: string;
  body?: string;
  link?: string;
  email?: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(
    @InjectRepository(Notification) private readonly notif: Repository<Notification>,
    @InjectRepository(EmailOutbox) private readonly outbox: Repository<EmailOutbox>,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  /** Notify one user (and optionally enqueue an email to them). */
  async notify(orgId: string, userId: string, p: NotifyPayload): Promise<Notification> {
    const n = await this.notif.save(this.notif.create({ orgId, userId, type: p.type, title: p.title, body: p.body, link: p.link }));
    if (p.email) {
      const rows = (await this.db.query(`SELECT email FROM app_user WHERE id = $1`, [userId])) as Array<{ email: string }>;
      if (rows[0]?.email) await this.enqueueEmail(orgId, rows[0].email, p.title, p.body || p.title);
    }
    return n;
  }

  /** Fan out to every active user in the org (optionally excluding the actor). Best-effort. */
  async notifyOrg(orgId: string, p: NotifyPayload, exceptUserId?: string): Promise<void> {
    try {
      const users = (await this.db.query(
        `SELECT id, email FROM app_user WHERE org_id = $1 AND is_active = true`,
        [orgId],
      )) as Array<{ id: string; email: string }>;
      for (const u of users) {
        if (exceptUserId && u.id === exceptUserId) continue;
        await this.notif.insert({ orgId, userId: u.id, type: p.type, title: p.title, body: p.body, link: p.link });
        if (p.email && u.email) await this.enqueueEmail(orgId, u.email, p.title, p.body || p.title);
      }
    } catch (e) {
      this.logger.warn(`notifyOrg failed: ${(e as Error).message}`);
    }
  }

  /** Outbox pattern: persist the email; a worker/cron drains it to SMTP/Resend (not yet configured). */
  async enqueueEmail(orgId: string, toEmail: string, subject: string, body: string): Promise<void> {
    await this.outbox.insert({ orgId, toEmail, subject, body });
    this.logger.log(`email queued → ${toEmail}: ${subject}`);
  }

  list(userId: string, opts: { unreadOnly?: boolean; limit?: number }): Promise<Notification[]> {
    return this.notif.find({
      where: opts.unreadOnly ? { userId, isRead: false } : { userId },
      order: { createdAt: 'DESC' },
      take: Math.min(opts.limit || 50, 200),
    });
  }
  unreadCount(userId: string): Promise<number> {
    return this.notif.count({ where: { userId, isRead: false } });
  }
  async markRead(userId: string, id: string): Promise<void> {
    await this.notif.update({ id, userId }, { isRead: true, readAt: new Date() });
  }
  async markAllRead(userId: string): Promise<void> {
    await this.notif.update({ userId, isRead: false }, { isRead: true, readAt: new Date() });
  }
}
