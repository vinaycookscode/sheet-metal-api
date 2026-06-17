import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { DOWNTIME_REASONS, DowntimeReason } from '../../common/enums';

/** A period a work center was down (drives OEE availability + downtime-by-reason). */
@Entity({ name: 'downtime_event' })
export class DowntimeEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ name: 'work_center_id', type: 'uuid' })
  workCenterId: string;

  /** Optional — the operation that was running when it went down. */
  @Column({ name: 'wo_operation_id', type: 'uuid', nullable: true })
  woOperationId?: string;

  @Column({ type: 'enum', enum: DOWNTIME_REASONS, enumName: 'downtime_reason' })
  reason: DowntimeReason;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  /** Null while the work center is still down. */
  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt?: Date;

  @Column({ name: 'logged_by', type: 'uuid', nullable: true })
  loggedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
