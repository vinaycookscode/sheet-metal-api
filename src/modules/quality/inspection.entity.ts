import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { INSPECTION_KINDS, INSPECTION_RESULTS, InspectionKind, InspectionResult } from '../../common/enums';
import { InspectionChar } from './inspection-char.entity';

/** Maps onto `inspection` — an inspection record tied to a WO / SO line / GRN line. */
@Entity({ name: 'inspection' })
export class Inspection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ type: 'enum', enum: INSPECTION_KINDS, enumName: 'inspection_kind' })
  kind: InspectionKind;

  @Column({ type: 'enum', enum: INSPECTION_RESULTS, enumName: 'inspection_result', default: 'pending' })
  result: InspectionResult;

  @Column({ name: 'work_order_id', type: 'uuid', nullable: true })
  workOrderId?: string;

  @Column({ name: 'grn_line_id', type: 'uuid', nullable: true })
  grnLineId?: string;

  @Column({ name: 'so_line_id', type: 'uuid', nullable: true })
  soLineId?: string;

  @Column({ name: 'inspector_id', type: 'uuid', nullable: true })
  inspectorId?: string;

  @Column({ name: 'inspected_at', type: 'timestamptz', nullable: true })
  inspectedAt?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => InspectionChar, (c) => c.inspection, { cascade: true })
  characteristics: InspectionChar[];
}
