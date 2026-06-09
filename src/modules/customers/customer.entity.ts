import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/** Maps onto the `customer` table in SCHEMA.sql. */
@Entity({ name: 'customer' })
export class Customer extends BaseEntity {
  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 24 })
  code: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  gstin?: string;

  @Column({ name: 'state_code', type: 'varchar', length: 2, nullable: true })
  stateCode?: string;

  @Column({ name: 'billing_address', type: 'jsonb', nullable: true })
  billingAddress?: Record<string, unknown>;

  @Column({ name: 'shipping_address', type: 'jsonb', nullable: true })
  shippingAddress?: Record<string, unknown>;

  @Column({ name: 'payment_terms_days', type: 'int', default: 30 })
  paymentTermsDays: number;

  @Column({ name: 'credit_limit', type: 'numeric', precision: 14, scale: 2, default: 0 })
  creditLimit: number;
}
