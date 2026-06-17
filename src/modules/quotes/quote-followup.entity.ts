import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { QUOTE_FOLLOWUP_KINDS, QuoteFollowupKind } from '../../common/enums';

/**
 * One entry in a quote's negotiation timeline — a send, a customer/internal response,
 * a revision, or a note. Captures reject reasons and counter-offers so the whole
 * back-and-forth is visible.
 */
@Entity({ name: 'quote_followup' })
export class QuoteFollowup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quote_id', type: 'uuid' })
  quoteId: string;

  @Column({ name: 'quote_version_id', type: 'uuid', nullable: true })
  quoteVersionId?: string;

  @Column({ type: 'enum', enum: QUOTE_FOLLOWUP_KINDS, enumName: 'quote_followup_kind' })
  kind: QuoteFollowupKind;

  /** Who logged it: 'customer' (via the public link) or 'internal'. */
  @Column({ type: 'varchar', length: 12, default: 'internal' })
  source: string;

  @Column({ type: 'text', nullable: true })
  note?: string;

  /** Reject reason code (QUOTE_REJECT_REASONS) when kind = rejected. */
  @Column({ name: 'reject_reason', type: 'varchar', length: 24, nullable: true })
  rejectReason?: string;

  /** Customer's proposed total when bargaining. */
  @Column({ name: 'counter_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  counterAmount?: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
