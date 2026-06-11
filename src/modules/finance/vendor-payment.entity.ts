import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** A payment made to a supplier against a supplier invoice (Accounts Payable). */
@Entity({ name: 'vendor_payment' })
export class VendorPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  @Column({ name: 'supplier_invoice_id', type: 'uuid', nullable: true })
  supplierInvoiceId?: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 24, nullable: true })
  method?: string;

  @Column({ type: 'text', nullable: true })
  reference?: string;

  @CreateDateColumn({ name: 'paid_at', type: 'timestamptz' })
  paidAt: Date;
}
