import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** A request for quotation issued to suppliers (SM-240). */
@Entity({ name: 'rfq' })
export class Rfq {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ type: 'varchar', length: 24 })
  number: string;

  /** open | awarded | closed */
  @Column({ type: 'varchar', length: 16, default: 'open' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
