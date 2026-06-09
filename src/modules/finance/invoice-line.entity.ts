import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Invoice } from './invoice.entity';

/** Maps onto `invoice_line`. */
@Entity({ name: 'invoice_line' })
export class InvoiceLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @Column({ name: 'line_no', type: 'int' })
  lineNo: number;

  @Column({ name: 'so_line_id', type: 'uuid', nullable: true })
  soLineId?: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'hsn_sac', type: 'varchar', length: 8, nullable: true })
  hsnSac?: string;

  @Column({ type: 'numeric', precision: 12, scale: 3 })
  qty: number;

  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 4 })
  unitPrice: number;

  @Column({ name: 'taxable_value', type: 'numeric', precision: 14, scale: 2 })
  taxableValue: number;

  @Column({ name: 'gst_rate', type: 'numeric', precision: 5, scale: 2 })
  gstRate: number;

  @Column({ name: 'tax_amount', type: 'numeric', precision: 14, scale: 2 })
  taxAmount: number;

  @ManyToOne(() => Invoice, (i) => i.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;
}
