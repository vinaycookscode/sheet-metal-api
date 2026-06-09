import { Entity, Column, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** Maps onto the `doc_sequence` table — one counter per plant/doc-type/fiscal-year. */
@Entity({ name: 'doc_sequence' })
@Unique(['plantId', 'docType', 'fiscalYear'])
export class DocSequence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ name: 'doc_type', type: 'varchar', length: 16 })
  docType: string;

  @Column({ name: 'fiscal_year', type: 'varchar', length: 9 })
  fiscalYear: string;

  @Column({ type: 'varchar', length: 16 })
  prefix: string;

  // bigint is returned as a string by the pg driver.
  @Column({ name: 'next_value', type: 'bigint', default: 1 })
  nextValue: string;

  @Column({ name: 'pad_width', type: 'int', default: 5 })
  padWidth: number;
}
