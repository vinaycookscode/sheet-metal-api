import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { NCR_DISPOSITIONS, NCR_STATUSES, NcrDisposition, NcrStatus } from '../../common/enums';

/** Maps onto `ncr` — non-conformance report. */
@Entity({ name: 'ncr' })
export class Ncr {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ type: 'varchar', length: 24 })
  number: string;

  @Column({ type: 'varchar', length: 24, nullable: true })
  source?: string;

  @Column({ name: 'work_order_id', type: 'uuid', nullable: true })
  workOrderId?: string;

  @Column({ name: 'stock_lot_id', type: 'uuid', nullable: true })
  stockLotId?: string;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId?: string;

  @Column({ type: 'text' })
  defect: string;

  @Column({ name: 'is_critical', type: 'boolean', default: false })
  isCritical: boolean;

  @Column({ type: 'enum', enum: NCR_DISPOSITIONS, enumName: 'ncr_disposition', default: 'pending' })
  disposition: NcrDisposition;

  @Column({ type: 'enum', enum: NCR_STATUSES, enumName: 'ncr_status', default: 'open' })
  status: NcrStatus;

  @Column({ name: 'cost_of_quality', type: 'numeric', precision: 12, scale: 2, nullable: true })
  costOfQuality?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt?: Date;
}
