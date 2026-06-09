import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Maps onto `labor_entry` — a shop-floor clock-on/off record against a WO operation. */
@Entity({ name: 'labor_entry' })
export class LaborEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'wo_operation_id', type: 'uuid' })
  woOperationId: string;

  @Column({ name: 'operator_id', type: 'uuid' })
  operatorId: string;

  @Column({ name: 'clock_in', type: 'timestamptz' })
  clockIn: Date;

  @Column({ name: 'clock_out', type: 'timestamptz', nullable: true })
  clockOut?: Date;

  @Column({ name: 'qty_good', type: 'numeric', precision: 12, scale: 3, default: 0 })
  qtyGood: number;

  @Column({ name: 'qty_scrap', type: 'numeric', precision: 12, scale: 3, default: 0 })
  qtyScrap: number;

  @Column({ name: 'scrap_reason', type: 'varchar', length: 40, nullable: true })
  scrapReason?: string;

  @Column({ type: 'boolean', default: false })
  rework: boolean;
}
