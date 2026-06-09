import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OP_STATUSES, OpStatus } from '../../common/enums';
import { WorkOrder } from './work-order.entity';

/** Maps onto `wo_operation` — a runtime copy of a routing op for a work order. */
@Entity({ name: 'wo_operation' })
export class WoOperation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'work_order_id', type: 'uuid' })
  workOrderId: string;

  @Column({ name: 'op_no', type: 'int' })
  opNo: number;

  @Column({ name: 'routing_op_id', type: 'uuid', nullable: true })
  routingOpId?: string;

  @Column({ name: 'work_center_id', type: 'uuid', nullable: true })
  workCenterId?: string;

  @Column({ type: 'enum', enum: OP_STATUSES, enumName: 'op_status', default: 'queued' })
  status: OpStatus;

  @Column({ name: 'is_outside', type: 'boolean', default: false })
  isOutside: boolean;

  @Column({ name: 'qty_good', type: 'numeric', precision: 12, scale: 3, default: 0 })
  qtyGood: number;

  @Column({ name: 'qty_scrap', type: 'numeric', precision: 12, scale: 3, default: 0 })
  qtyScrap: number;

  @ManyToOne(() => WorkOrder, (wo) => wo.operations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_order_id' })
  workOrder: WorkOrder;
}
