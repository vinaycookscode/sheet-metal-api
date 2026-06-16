import { Column, Entity, OneToMany } from 'typeorm';
import { AuditedEntity } from '../../common/entities/audited.entity';
import { INQUIRY_STATUSES, InquiryStatus } from '../../common/enums';
import { InquiryLine } from './inquiry-line.entity';

/** Maps onto the `inquiry` table (CRM header). Cancelled via status, not soft-delete. */
@Entity({ name: 'inquiry' })
export class Inquiry extends AuditedEntity {
  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ type: 'varchar', length: 24 })
  number: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId?: string;

  @Column({ type: 'enum', enum: INQUIRY_STATUSES, enumName: 'inquiry_status', default: 'new' })
  status: InquiryStatus;

  @Column({ name: 'required_date', type: 'date', nullable: true })
  requiredDate?: string;

  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId?: string;

  @Column({ name: 'estimator_id', type: 'uuid', nullable: true })
  estimatorId?: string;

  @Column({ name: 'lost_reason', type: 'varchar', length: 40, nullable: true })
  lostReason?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => InquiryLine, (line) => line.inquiry, { cascade: true })
  lines: InquiryLine[];
}
