import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { GRN_STATUSES, GrnStatus } from '../../common/enums';
import { GrnLine } from './grn-line.entity';

/** Maps onto `grn` (goods receipt note). */
@Entity({ name: 'grn' })
export class Grn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ type: 'varchar', length: 24 })
  number: string;

  @Column({ name: 'purchase_order_id', type: 'uuid' })
  purchaseOrderId: string;

  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  @Column({ type: 'enum', enum: GRN_STATUSES, enumName: 'grn_status', default: 'draft' })
  status: GrnStatus;

  @Column({ name: 'received_date', type: 'date', default: () => 'current_date' })
  receivedDate: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => GrnLine, (l) => l.grn, { cascade: true })
  lines: GrnLine[];
}
