import { Column, Entity, OneToMany } from 'typeorm';
import { AuditedEntity } from '../../common/entities/audited.entity';
import { RoutingOp } from './routing-op.entity';
import { BomLine } from './bom-line.entity';

/** Maps onto the `part` table — rev-controlled engineering master, reusable across orders. */
@Entity({ name: 'part' })
export class Part extends AuditedEntity {
  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'part_no', type: 'varchar', length: 40 })
  partNo: string;

  @Column({ type: 'varchar', length: 8, default: 'A' })
  rev: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'material_grade_id', type: 'uuid', nullable: true })
  materialGradeId?: string;

  @Column({ name: 'thickness_mm', type: 'numeric', precision: 6, scale: 2, nullable: true })
  thicknessMm?: number;

  @Column({ name: 'finish_id', type: 'uuid', nullable: true })
  finishId?: string;

  @Column({ name: 'flat_length_mm', type: 'numeric', precision: 8, scale: 2, nullable: true })
  flatLengthMm?: number;

  @Column({ name: 'flat_width_mm', type: 'numeric', precision: 8, scale: 2, nullable: true })
  flatWidthMm?: number;

  @Column({ name: 'bend_count', type: 'int', default: 0 })
  bendCount: number;

  @Column({ name: 'is_released', type: 'boolean', default: false })
  isReleased: boolean;

  @OneToMany(() => RoutingOp, (op) => op.part, { cascade: true })
  routingOps: RoutingOp[];

  @OneToMany(() => BomLine, (line) => line.part, { cascade: true })
  bomLines: BomLine[];
}
