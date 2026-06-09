import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { QuoteVersion } from './quote-version.entity';
import { EstimateDetail } from './estimate-detail.entity';

/** Maps onto `quote_line` — one priced part on a quote version. */
@Entity({ name: 'quote_line' })
export class QuoteLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quote_version_id', type: 'uuid' })
  quoteVersionId: string;

  @Column({ name: 'inquiry_line_id', type: 'uuid', nullable: true })
  inquiryLineId?: string;

  @Column({ name: 'line_no', type: 'int' })
  lineNo: number;

  @Column({ name: 'part_name', type: 'text' })
  partName: string;

  @Column({ name: 'primary_qty', type: 'numeric', precision: 12, scale: 3 })
  primaryQty: number;

  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 4 })
  unitPrice: number;

  @Column({ name: 'qty_break_prices', type: 'jsonb', nullable: true })
  qtyBreakPrices?: Array<{ qty: number; price: number }>;

  @Column({ name: 'material_cost', type: 'numeric', precision: 12, scale: 4, default: 0 })
  materialCost: number;

  @Column({ name: 'process_cost', type: 'numeric', precision: 12, scale: 4, default: 0 })
  processCost: number;

  @Column({ name: 'hardware_cost', type: 'numeric', precision: 12, scale: 4, default: 0 })
  hardwareCost: number;

  @Column({ name: 'outside_cost', type: 'numeric', precision: 12, scale: 4, default: 0 })
  outsideCost: number;

  @Column({ name: 'setup_cost', type: 'numeric', precision: 12, scale: 4, default: 0 })
  setupCost: number;

  @Column({ name: 'margin_pct', type: 'numeric', precision: 6, scale: 2, nullable: true })
  marginPct?: number;

  @Column({ name: 'tax_code_id', type: 'uuid', nullable: true })
  taxCodeId?: string;

  @OneToMany(() => EstimateDetail, (d) => d.line, { cascade: true })
  estimateDetails: EstimateDetail[];

  @ManyToOne(() => QuoteVersion, (v) => v.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quote_version_id' })
  version: QuoteVersion;
}
