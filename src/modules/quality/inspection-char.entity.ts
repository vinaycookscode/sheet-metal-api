import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { INSPECTION_RESULTS, InspectionResult } from '../../common/enums';
import { Inspection } from './inspection.entity';

/** Maps onto `inspection_char` — one measured/attribute characteristic. */
@Entity({ name: 'inspection_char' })
export class InspectionChar {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'inspection_id', type: 'uuid' })
  inspectionId: string;

  @Column({ type: 'text' })
  characteristic: string;

  @Column({ type: 'numeric', precision: 12, scale: 4, nullable: true })
  nominal?: number;

  @Column({ name: 'tolerance_plus', type: 'numeric', precision: 12, scale: 4, nullable: true })
  tolerancePlus?: number;

  @Column({ name: 'tolerance_minus', type: 'numeric', precision: 12, scale: 4, nullable: true })
  toleranceMinus?: number;

  @Column({ type: 'numeric', precision: 12, scale: 4, nullable: true })
  measured?: number;

  @Column({ type: 'enum', enum: INSPECTION_RESULTS, enumName: 'inspection_result', default: 'pending' })
  result: InspectionResult;

  @ManyToOne(() => Inspection, (i) => i.characteristics, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inspection_id' })
  inspection: Inspection;
}
