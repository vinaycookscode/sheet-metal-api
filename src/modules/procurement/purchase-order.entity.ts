import { Column, Entity, OneToMany } from 'typeorm';
import { AuditedEntity } from '../../common/entities/audited.entity';
import { PO_STATUSES, PoStatus } from '../../common/enums';
import { PoLine } from './po-line.entity';

/** Maps onto `purchase_order`. */
@Entity({ name: 'purchase_order' })
export class PurchaseOrder extends AuditedEntity {
  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ type: 'varchar', length: 24 })
  number: string;

  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  @Column({ type: 'enum', enum: PO_STATUSES, enumName: 'po_status', default: 'draft' })
  status: PoStatus;

  @Column({ name: 'is_subcontract', type: 'boolean', default: false })
  isSubcontract: boolean;

  @Column({ name: 'order_date', type: 'date', default: () => 'current_date' })
  orderDate: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy?: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  subtotal: number;

  @Column({ name: 'tax_total', type: 'numeric', precision: 14, scale: 2, default: 0 })
  taxTotal: number;

  @Column({ name: 'grand_total', type: 'numeric', precision: 14, scale: 2, default: 0 })
  grandTotal: number;

  @OneToMany(() => PoLine, (l) => l.purchaseOrder, { cascade: true })
  lines: PoLine[];
}
