import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Append-only audit trail — one row per mutating request. */
@Entity({ name: 'audit_log' })
export class AuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 40 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({ type: 'varchar', length: 16 })
  action: string;

  @Column({ type: 'jsonb', nullable: true })
  before?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'at', type: 'timestamptz' })
  at: Date;
}
