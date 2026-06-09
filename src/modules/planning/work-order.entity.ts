import { Column, Entity, OneToMany } from 'typeorm';
import { AuditedEntity } from '../../common/entities/audited.entity';
import { WO_STATUSES, WoStatus } from '../../common/enums';
import { WoOperation } from './wo-operation.entity';

/** Maps onto `work_order` — pegged to an so_line (pure MTO). */
@Entity({ name: 'work_order' })
export class WorkOrder extends AuditedEntity {
  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ type: 'varchar', length: 24 })
  number: string;

  @Column({ name: 'so_line_id', type: 'uuid' })
  soLineId: string;

  @Column({ name: 'part_id', type: 'uuid' })
  partId: string;

  @Column({ type: 'numeric', precision: 12, scale: 3 })
  qty: number;

  @Column({ name: 'qty_completed', type: 'numeric', precision: 12, scale: 3, default: 0 })
  qtyCompleted: number;

  @Column({ name: 'qty_scrapped', type: 'numeric', precision: 12, scale: 3, default: 0 })
  qtyScrapped: number;

  @Column({ type: 'enum', enum: WO_STATUSES, enumName: 'wo_status', default: 'planned' })
  status: WoStatus;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate?: string;

  @Column({ name: 'released_at', type: 'timestamptz', nullable: true })
  releasedAt?: Date;

  @OneToMany(() => WoOperation, (op) => op.workOrder, { cascade: true })
  operations: WoOperation[];
}
