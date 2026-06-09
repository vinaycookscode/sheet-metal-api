import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Maps onto `stock_lot` — a quantity of an item at a location, optionally heat/lot tracked. */
@Entity({ name: 'stock_lot' })
export class StockLot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @Column({ name: 'heat_no', type: 'varchar', length: 40, nullable: true })
  heatNo?: string;

  @Column({ name: 'lot_no', type: 'varchar', length: 40, nullable: true })
  lotNo?: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  location?: string;

  @Column({ name: 'qty_on_hand', type: 'numeric', precision: 14, scale: 3, default: 0 })
  qtyOnHand: number;

  @Column({ name: 'qty_allocated', type: 'numeric', precision: 14, scale: 3, default: 0 })
  qtyAllocated: number;

  @Column({ name: 'unit_cost', type: 'numeric', precision: 12, scale: 4, nullable: true })
  unitCost?: number;

  @Column({ name: 'is_remnant', type: 'boolean', default: false })
  isRemnant: boolean;

  @Column({ name: 'grn_line_id', type: 'uuid', nullable: true })
  grnLineId?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
