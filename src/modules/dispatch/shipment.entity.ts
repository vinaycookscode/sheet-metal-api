import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { SHIPMENT_STATUSES, ShipmentStatus } from '../../common/enums';
import { PackingLine } from './packing-line.entity';

/** Maps onto `shipment` — a dispatch / delivery challan against a sales order. */
@Entity({ name: 'shipment' })
export class Shipment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ type: 'varchar', length: 24 })
  number: string;

  @Column({ name: 'sales_order_id', type: 'uuid' })
  salesOrderId: string;

  @Column({ type: 'enum', enum: SHIPMENT_STATUSES, enumName: 'shipment_status', default: 'draft' })
  status: ShipmentStatus;

  @Column({ name: 'dispatch_date', type: 'date', nullable: true })
  dispatchDate?: string;

  @Column({ type: 'text', nullable: true })
  carrier?: string;

  @Column({ name: 'freight_cost', type: 'numeric', precision: 12, scale: 2, nullable: true })
  freightCost?: number;

  @Column({ name: 'tracking_no', type: 'text', nullable: true })
  trackingNo?: string;

  @Column({ name: 'total_weight_kg', type: 'numeric', precision: 12, scale: 3, nullable: true })
  totalWeightKg?: number;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt?: Date;

  @Column({ name: 'accepted_by', type: 'text', nullable: true })
  acceptedBy?: string;

  @Column({ name: 'acceptance_note', type: 'text', nullable: true })
  acceptanceNote?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => PackingLine, (l) => l.shipment, { cascade: true })
  lines: PackingLine[];
}
