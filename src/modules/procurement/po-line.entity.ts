import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';

/** Maps onto `po_line`. */
@Entity({ name: 'po_line' })
export class PoLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_order_id', type: 'uuid' })
  purchaseOrderId: string;

  @Column({ name: 'line_no', type: 'int' })
  lineNo: number;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @Column({ type: 'numeric', precision: 12, scale: 3 })
  qty: number;

  @Column({ name: 'qty_received', type: 'numeric', precision: 12, scale: 3, default: 0 })
  qtyReceived: number;

  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 4 })
  unitPrice: number;

  @Column({ name: 'tax_code_id', type: 'uuid', nullable: true })
  taxCodeId?: string;

  @Column({ name: 'requisition_id', type: 'uuid', nullable: true })
  requisitionId?: string;

  @ManyToOne(() => PurchaseOrder, (po) => po.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;
}
