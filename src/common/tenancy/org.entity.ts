import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Read model for the `org` table (seller identity on documents). */
@Entity({ name: 'org' })
export class Org {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'legal_name', type: 'text', nullable: true })
  legalName?: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  gstin?: string;

  @Column({ name: 'state_code', type: 'varchar', length: 2, nullable: true })
  stateCode?: string;
}
