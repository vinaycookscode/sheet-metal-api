import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { PROJECT_STATUSES, ProjectStatus } from '../../common/enums';

/**
 * A customer program/job that groups a customer's inquiries, quotes and sales
 * orders (Customer → Project → Orders). Master-like, so it extends BaseEntity
 * (full audit + soft-delete). `code` is auto-allocated (PRJ-...) when not given.
 */
@Entity({ name: 'project' })
export class Project extends BaseEntity {
  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ type: 'varchar', length: 24 })
  code: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'enum', enum: PROJECT_STATUSES, enumName: 'project_status', default: 'active' })
  status: ProjectStatus;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'target_date', type: 'date', nullable: true })
  targetDate?: string;
}
