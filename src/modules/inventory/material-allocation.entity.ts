import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Maps onto `material_allocation` — stock reserved for a work order. */
@Entity({ name: 'material_allocation' })
export class MaterialAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'work_order_id', type: 'uuid' })
  workOrderId: string;

  @Column({ name: 'stock_lot_id', type: 'uuid' })
  stockLotId: string;

  @Column({ name: 'qty_allocated', type: 'numeric', precision: 14, scale: 3 })
  qtyAllocated: number;

  @Column({ name: 'qty_issued', type: 'numeric', precision: 14, scale: 3, default: 0 })
  qtyIssued: number;
}
