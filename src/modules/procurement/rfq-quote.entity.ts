import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** A supplier's quoted price for one RFQ line (SM-240). */
@Entity({ name: 'rfq_quote' })
export class RfqQuote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'rfq_id', type: 'uuid' })
  rfqId: string;

  @Column({ name: 'rfq_line_id', type: 'uuid' })
  rfqLineId: string;

  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  @Column({ name: 'unit_price', type: 'numeric', precision: 14, scale: 4 })
  unitPrice: number;

  @Column({ name: 'lead_days', type: 'int', nullable: true })
  leadDays?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
