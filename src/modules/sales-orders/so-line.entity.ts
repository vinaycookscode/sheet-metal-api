import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SO_LINE_STATUSES, SoLineStatus } from '../../common/enums';
import { SalesOrder } from './sales-order.entity';

/** Maps onto the `so_line` table — one ordered part with a promised date. */
@Entity({ name: 'so_line' })
export class SoLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sales_order_id', type: 'uuid' })
  salesOrderId: string;

  @Column({ name: 'line_no', type: 'int' })
  lineNo: number;

  @Column({ name: 'quote_line_id', type: 'uuid', nullable: true })
  quoteLineId?: string;

  @Column({ name: 'part_id', type: 'uuid', nullable: true })
  partId?: string;

  @Column({ name: 'part_name', type: 'text' })
  partName: string;

  @Column({ type: 'numeric', precision: 12, scale: 3 })
  qty: number;

  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 4 })
  unitPrice: number;

  @Column({ name: 'promised_date', type: 'date', nullable: true })
  promisedDate?: string;

  @Column({ type: 'enum', enum: SO_LINE_STATUSES, enumName: 'so_line_status', default: 'open' })
  status: SoLineStatus;

  @Column({ name: 'tax_code_id', type: 'uuid', nullable: true })
  taxCodeId?: string;

  @ManyToOne(() => SalesOrder, (so) => so.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sales_order_id' })
  salesOrder: SalesOrder;
}
