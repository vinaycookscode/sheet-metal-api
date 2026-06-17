import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Read model for the `plant` table (seller plant on documents). */
@Entity({ name: 'plant' })
export class Plant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 16 })
  code: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  gstin?: string;

  @Column({ name: 'state_code', type: 'varchar', length: 2 })
  stateCode: string;

  @Column({ type: 'jsonb', nullable: true })
  address?: Record<string, unknown>;
}
