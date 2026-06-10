import { Column, Entity, OneToMany } from 'typeorm';
import { AuditedEntity } from '../../common/entities/audited.entity';
import { GST_TREATMENTS, GstTreatment, SO_STATUSES, SoStatus } from '../../common/enums';
import { SoLine } from './so-line.entity';

/** Maps onto the `sales_order` table. */
@Entity({ name: 'sales_order' })
export class SalesOrder extends AuditedEntity {
  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ type: 'varchar', length: 24 })
  number: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ name: 'quote_version_id', type: 'uuid', nullable: true })
  quoteVersionId?: string;

  @Column({ name: 'customer_po_number', type: 'text', nullable: true })
  customerPoNumber?: string;

  @Column({ name: 'vendor_code', type: 'varchar', length: 40, nullable: true })
  vendorCode?: string;

  @Column({ type: 'enum', enum: SO_STATUSES, enumName: 'so_status', default: 'confirmed' })
  status: SoStatus;

  @Column({ name: 'gst_treatment', type: 'enum', enum: GST_TREATMENTS, enumName: 'gst_treatment', nullable: true })
  gstTreatment?: GstTreatment;

  @Column({ name: 'order_date', type: 'date', default: () => 'current_date' })
  orderDate: string;

  @OneToMany(() => SoLine, (line) => line.salesOrder, { cascade: true })
  lines: SoLine[];
}
