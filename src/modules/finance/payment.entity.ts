import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Maps onto `payment` — a customer receipt, optionally applied to an invoice. */
@Entity({ name: 'payment' })
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  invoiceId?: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 24, nullable: true })
  method?: string;

  @Column({ type: 'text', nullable: true })
  reference?: string;

  @CreateDateColumn({ name: 'paid_at', type: 'timestamptz' })
  paidAt: Date;
}
