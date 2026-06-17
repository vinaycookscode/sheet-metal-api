import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Inquiry } from '../inquiries/inquiry.entity';
import { Quote } from '../quotes/quote.entity';
import { Customer } from '../customers/customer.entity';

export type TaskPriority = 'high' | 'normal' | 'low';

/** One actionable "do this next" card in a user's Task Inbox. */
export interface TaskItem {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  link: string;
  actionLabel: string;
  priority: TaskPriority;
}

export interface TaskInbox {
  items: TaskItem[];
  total: number;
}

const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };

/**
 * Role-aware "what needs me now" feed. Items are derived from what the user can
 * actually see (their permission codes), so the same endpoint serves every persona —
 * a Sales/Estimator gets inquiries to estimate and quotes to send/follow-up.
 * All reads go through the TypeORM repository API (no raw SQL).
 */
@Injectable()
export class TasksService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async inbox(user: AuthUser): Promise<TaskInbox> {
    const plantId = user.plantId as string;
    const isAdmin = user.roles?.includes('admin') ?? false;
    const can = (perm: string) => isAdmin || (user.permissions?.includes(perm) ?? false);

    const drafts: { item: TaskItem; customerId?: string }[] = [];

    // Commercial — inquiries waiting to be estimated / turned into a quote.
    if (can('inquiry.read')) {
      const inquiries = await this.db.getRepository(Inquiry).find({
        where: { plantId, status: In(['new', 'estimating']) },
        order: { createdAt: 'ASC' },
        take: 25,
      });
      for (const i of inquiries) {
        const isNew = i.status === 'new';
        drafts.push({
          customerId: i.customerId,
          item: {
            id: i.id,
            kind: isNew ? 'inquiry_new' : 'inquiry_estimating',
            title: isNew ? 'New inquiry — start estimating' : 'Estimate in progress — turn it into a quote',
            subtitle: i.number,
            link: `/inquiries/${i.id}`,
            actionLabel: isNew ? 'Start' : 'Create quote',
            priority: isNew ? 'high' : 'normal',
          },
        });
      }
    }

    // Commercial — quotes to send (draft), negotiate, or chase (sent).
    if (can('quote.read')) {
      const quotes = await this.db.getRepository(Quote).find({
        where: { plantId, status: In(['draft', 'sent', 'negotiating']) },
        order: { createdAt: 'ASC' },
        take: 30,
      });
      const today = new Date().toISOString().slice(0, 10);
      for (const q of quotes) {
        const dueFollowUp = !!q.nextFollowUpDate && q.nextFollowUpDate <= today;
        let kind: string, title: string, actionLabel: string, priority: TaskPriority;
        if (q.status === 'draft') {
          kind = 'quote_draft'; title = 'Draft quote — send it to the customer'; actionLabel = 'Review & send'; priority = 'high';
        } else if (q.status === 'negotiating') {
          kind = 'quote_negotiating'; title = 'Customer is negotiating — revise & resend'; actionLabel = 'Open'; priority = 'high';
        } else if (dueFollowUp) {
          kind = 'quote_followup'; title = "Follow up — customer hasn't responded"; actionLabel = 'Follow up'; priority = 'high';
        } else {
          kind = 'quote_sent'; title = 'Quote sent — awaiting a decision'; actionLabel = 'Follow up'; priority = 'low';
        }
        drafts.push({ customerId: q.customerId, item: { id: q.id, kind, title, subtitle: q.number, link: `/quotes/${q.id}`, actionLabel, priority } });
      }
    }

    // Enrich subtitles with the customer name (one batched lookup).
    const customerIds = [...new Set(drafts.map((d) => d.customerId).filter((id): id is string => !!id))];
    if (customerIds.length) {
      const customers = await this.db.getRepository(Customer).find({
        where: { id: In(customerIds) },
        select: { id: true, name: true },
      });
      const nameById = new Map(customers.map((c) => [c.id, c.name]));
      for (const d of drafts) {
        const name = d.customerId ? nameById.get(d.customerId) : undefined;
        if (name) d.item.subtitle = `${d.item.subtitle} · ${name}`;
      }
    }

    const items = drafts
      .map((d) => d.item)
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

    return { items, total: items.length };
  }
}
