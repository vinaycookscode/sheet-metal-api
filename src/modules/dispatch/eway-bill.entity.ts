import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Maps onto `eway_bill` — generated GST e-way bill for a shipment. */
@Entity({ name: 'eway_bill' })
export class EwayBill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shipment_id', type: 'uuid' })
  shipmentId: string;

  @Column({ name: 'ewb_number', type: 'varchar', length: 20, nullable: true })
  ewbNumber?: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  value?: number;

  @Column({ name: 'distance_km', type: 'int', nullable: true })
  distanceKm?: number;

  @Column({ name: 'vehicle_no', type: 'varchar', length: 20, nullable: true })
  vehicleNo?: string;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown>;

  @Column({ name: 'generated_at', type: 'timestamptz', nullable: true })
  generatedAt?: Date;
}
