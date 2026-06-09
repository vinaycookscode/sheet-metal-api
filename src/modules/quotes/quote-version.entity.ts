import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Quote } from './quote.entity';
import { QuoteLine } from './quote-line.entity';

/** Maps onto `quote_version` — an immutable priced revision of a quote. */
@Entity({ name: 'quote_version' })
export class QuoteVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quote_id', type: 'uuid' })
  quoteId: string;

  @Column({ name: 'version_no', type: 'int' })
  versionNo: number;

  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil?: string;

  @Column({ name: 'lead_time_days', type: 'int', nullable: true })
  leadTimeDays?: number;

  @Column({ name: 'markup_pct', type: 'numeric', precision: 6, scale: 2, nullable: true })
  markupPct?: number;

  @Column({ type: 'text', nullable: true })
  terms?: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  subtotal: number;

  @Column({ name: 'tax_total', type: 'numeric', precision: 14, scale: 2, default: 0 })
  taxTotal: number;

  @Column({ name: 'grand_total', type: 'numeric', precision: 14, scale: 2, default: 0 })
  grandTotal: number;

  @Column({ name: 'is_current', type: 'boolean', default: true })
  isCurrent: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => QuoteLine, (l) => l.version, { cascade: true })
  lines: QuoteLine[];

  @ManyToOne(() => Quote, (q) => q.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quote_id' })
  quote: Quote;
}
