import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/** Maps onto the `supplier` table in SCHEMA.sql. */
@Entity({ name: 'supplier' })
export class Supplier extends BaseEntity {
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

  @Column({ type: 'varchar', length: 24, nullable: true })
  category?: string;

  @Column({ name: 'lead_time_days', type: 'int', default: 7 })
  leadTimeDays: number;

  @Column({ name: 'payment_terms_days', type: 'int', default: 30 })
  paymentTermsDays: number;

  @Column({ type: 'numeric', precision: 3, scale: 1, nullable: true })
  rating?: number;
}
