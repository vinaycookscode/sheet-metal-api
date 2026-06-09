import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Invoice } from './invoice.entity';
import { Payment } from './payment.entity';
import { RecordPaymentDto } from './dto';
import { round2Money as round2 } from '../../common/tax';

interface Scope {
  plantId: string;
  userId: string;
}

@Injectable()
export class PaymentService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** Record a receipt (SM-165); apply to an invoice and roll its status. */
  async record(s: Scope, dto: RecordPaymentDto): Promise<Payment> {
    return this.db.transaction(async (em) => {
      if (dto.invoiceId) {
        const inv = await em.getRepository(Invoice).findOne({ where: { id: dto.invoiceId, plantId: s.plantId } });
        if (!inv) throw new NotFoundException('Invoice not found');
        if (inv.status === 'draft') throw new BadRequestException('Issue the invoice before recording payment');
        const paid = round2(Number(inv.amountPaid) + dto.amount);
        inv.amountPaid = paid;
        inv.status = paid >= Number(inv.grandTotal) ? 'paid' : paid > 0 ? 'partially_paid' : inv.status;
        await em.save(inv);
      }
      return em.save(em.create(Payment, { plantId: s.plantId, customerId: dto.customerId, invoiceId: dto.invoiceId, amount: dto.amount, method: dto.method, reference: dto.reference }));
    });
  }

  list(plantId: string, filter: { customerId?: string; invoiceId?: string }): Promise<Payment[]> {
    const where: Record<string, unknown> = { plantId };
    if (filter.customerId) where.customerId = filter.customerId;
    if (filter.invoiceId) where.invoiceId = filter.invoiceId;
    return this.db.getRepository(Payment).find({ where, order: { paidAt: 'DESC' }, take: 500 });
  }

  /** AR aging (SM-165): outstanding invoices bucketed by age. */
  async arAging(plantId: string) {
    const rows = (await this.db.query(
      `SELECT i.id, i.number, c.name AS customer, i.invoice_date,
              i.grand_total, i.amount_paid, (i.grand_total - i.amount_paid) AS outstanding,
              (current_date - i.invoice_date) AS age_days
         FROM invoice i JOIN customer c ON c.id = i.customer_id
        WHERE i.plant_id = $1 AND i.status IN ('issued', 'partially_paid') AND i.grand_total > i.amount_paid
        ORDER BY i.invoice_date`,
      [plantId],
    )) as Array<{ id: string; number: string; customer: string; invoice_date: string; grand_total: string; amount_paid: string; outstanding: string; age_days: number }>;

    const buckets = { current: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
    const invoices = rows.map((r) => {
      const out = Number(r.outstanding);
      const age = Number(r.age_days);
      const bucket = age <= 30 ? 'current' : age <= 60 ? 'd31_60' : age <= 90 ? 'd61_90' : 'd90plus';
      buckets[bucket] = round2(buckets[bucket] + out);
      return { invoice: r.number, customer: r.customer, invoiceDate: r.invoice_date, outstanding: out, ageDays: age, bucket };
    });
    const totalOutstanding = round2(invoices.reduce((a, i) => a + i.outstanding, 0));
    return { totalOutstanding, buckets, invoices };
  }
}
