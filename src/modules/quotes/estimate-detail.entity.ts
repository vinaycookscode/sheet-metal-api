import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { EstimateDetailType } from '../../common/enums';
import { QuoteLine } from './quote-line.entity';

/** Maps onto `estimate_detail` — granular cost build-up rows behind a quote line. */
@Entity({ name: 'estimate_detail' })
export class EstimateDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quote_line_id', type: 'uuid' })
  quoteLineId: string;

  @Column({ name: 'detail_type', type: 'varchar', length: 16 })
  detailType: EstimateDetailType;

  @Column({ name: 'ref_id', type: 'uuid', nullable: true })
  refId?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'numeric', precision: 12, scale: 4, nullable: true })
  qty?: number;

  @Column({ type: 'numeric', precision: 12, scale: 4, nullable: true })
  rate?: number;

  @Column({ name: 'yield_pct', type: 'numeric', precision: 6, scale: 2, nullable: true })
  yieldPct?: number;

  @Column({ type: 'numeric', precision: 14, scale: 4, default: 0 })
  amount: number;

  @ManyToOne(() => QuoteLine, (l) => l.estimateDetails, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quote_line_id' })
  line: QuoteLine;
}
