import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Maps onto `purchase_requisition` — planned material demand emitted by MRP. */
@Entity({ name: 'purchase_requisition' })
export class PurchaseRequisition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @Column({ type: 'numeric', precision: 12, scale: 3 })
  qty: number;

  @Column({ name: 'required_date', type: 'date', nullable: true })
  requiredDate?: string;

  @Column({ name: 'so_line_id', type: 'uuid', nullable: true })
  soLineId?: string;

  @Column({ name: 'mrp_run_id', type: 'uuid', nullable: true })
  mrpRunId?: string;

  @Column({ name: 'is_ordered', type: 'boolean', default: false })
  isOrdered: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
