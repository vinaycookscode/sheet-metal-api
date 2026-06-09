import { Column, CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Base for transactional header tables (inquiry, quote, sales_order, ...):
 * UUID PK + audit columns, but NO soft-delete column. These documents are
 * cancelled via their status enum, not soft-deleted — so unlike BaseEntity
 * there is no DeleteDateColumn (the matching tables have no `deleted_at`).
 */
export abstract class AuditedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;
}
