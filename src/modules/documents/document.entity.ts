import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Maps onto the polymorphic `document` table — versioned attachments on any entity. */
@Entity({ name: 'document' })
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 40 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({ type: 'varchar', length: 24 })
  kind: string;

  @Column({ name: 'file_name', type: 'text' })
  fileName: string;

  @Column({ name: 'storage_key', type: 'text' })
  storageKey: string;

  @Column({ name: 'mime_type', type: 'text', nullable: true })
  mimeType?: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy?: string;

  @Column({ name: 'review_status', type: 'varchar', length: 12, default: 'pending' })
  reviewStatus: string;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy?: string;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
