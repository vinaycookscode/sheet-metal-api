import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** A vendor's bill captured against a purchase order (Accounts Payable). */
@Entity({ name: 'supplier_invoice' })
export class SupplierInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  @Column({ name: 'purchase_order_id', type: 'uuid', nullable: true })
  purchaseOrderId?: string;

  @Column({ name: 'supplier_ref', type: 'text', nullable: true })
  supplierRef?: string;

  @Column({ name: 'invoice_date', type: 'date', default: () => 'current_date' })
  invoiceDate: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  subtotal: number;

  @Column({ name: 'tax_total', type: 'numeric', precision: 14, scale: 2, default: 0 })
  taxTotal: number;

  @Column({ name: 'grand_total', type: 'numeric', precision: 14, scale: 2, default: 0 })
  grandTotal: number;

  @Column({ name: 'amount_paid', type: 'numeric', precision: 14, scale: 2, default: 0 })
  amountPaid: number;

  /** unmatched | matched | variance (3-way match vs GRN-received value). */
  @Column({ name: 'match_status', type: 'varchar', length: 12, default: 'unmatched' })
  matchStatus: string;

  /** draft | approved | partially_paid | paid */
  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
