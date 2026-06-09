import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Part } from './part.entity';

/** Maps onto the `routing_op` table — one ordered operation in a part's routing. */
@Entity({ name: 'routing_op' })
export class RoutingOp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'part_id', type: 'uuid' })
  partId: string;

  @Column({ name: 'op_no', type: 'int' })
  opNo: number;

  @Column({ name: 'operation_id', type: 'uuid', nullable: true })
  operationId?: string;

  @Column({ name: 'work_center_id', type: 'uuid', nullable: true })
  workCenterId?: string;

  @Column({ name: 'setup_minutes', type: 'numeric', precision: 8, scale: 2, default: 0 })
  setupMinutes: number;

  @Column({ name: 'run_seconds_per_unit', type: 'numeric', precision: 10, scale: 3, default: 0 })
  runSecondsPerUnit: number;

  @Column({ name: 'is_outside', type: 'boolean', default: false })
  isOutside: boolean;

  @Column({ type: 'text', nullable: true })
  instructions?: string;

  @ManyToOne(() => Part, (part) => part.routingOps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'part_id' })
  part: Part;
}
