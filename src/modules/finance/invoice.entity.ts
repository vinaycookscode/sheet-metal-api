import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { GST_TREATMENTS, GstTreatment, INVOICE_STATUSES, InvoiceStatus } from '../../common/enums';
import { InvoiceLine } from './invoice-line.entity';

/** Maps onto `invoice` — GST tax invoice. */
@Entity({ name: 'invoice' })
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ type: 'varchar', length: 24 })
  number: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ name: 'sales_order_id', type: 'uuid', nullable: true })
  salesOrderId?: string;

  @Column({ name: 'shipment_id', type: 'uuid', nullable: true })
  shipmentId?: string;

  @Column({ type: 'enum', enum: INVOICE_STATUSES, enumName: 'invoice_status', default: 'draft' })
  status: InvoiceStatus;

  @Column({ name: 'gst_treatment', type: 'enum', enum: GST_TREATMENTS, enumName: 'gst_treatment' })
  gstTreatment: GstTreatment;

  @Column({ name: 'invoice_date', type: 'date', default: () => 'current_date' })
  invoiceDate: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  cgst: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  sgst: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  igst: number;

  @Column({ name: 'grand_total', type: 'numeric', precision: 14, scale: 2, default: 0 })
  grandTotal: number;

  @Column({ name: 'amount_paid', type: 'numeric', precision: 14, scale: 2, default: 0 })
  amountPaid: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => InvoiceLine, (l) => l.invoice, { cascade: true })
  lines: InvoiceLine[];
}
