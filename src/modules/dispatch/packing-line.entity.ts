import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Shipment } from './shipment.entity';

/** Maps onto `packing_line` — a packed quantity of an SO line in a shipment. */
@Entity({ name: 'packing_line' })
export class PackingLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shipment_id', type: 'uuid' })
  shipmentId: string;

  @Column({ name: 'so_line_id', type: 'uuid' })
  soLineId: string;

  @Column({ type: 'numeric', precision: 12, scale: 3 })
  qty: number;

  @Column({ name: 'box_no', type: 'varchar', length: 24, nullable: true })
  boxNo?: string;

  @Column({ name: 'weight_kg', type: 'numeric', precision: 12, scale: 3, nullable: true })
  weightKg?: number;

  @ManyToOne(() => Shipment, (s) => s.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shipment_id' })
  shipment: Shipment;
}
