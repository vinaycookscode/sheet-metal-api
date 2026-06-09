import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { STOCK_TXN_TYPES, StockTxnType } from '../../common/enums';

/** Maps onto `stock_txn` — append-only stock movement ledger. */
@Entity({ name: 'stock_txn' })
export class StockTxn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plant_id', type: 'uuid' })
  plantId: string;

  @Column({ name: 'stock_lot_id', type: 'uuid' })
  stockLotId: string;

  @Column({ name: 'txn_type', type: 'enum', enum: STOCK_TXN_TYPES, enumName: 'stock_txn_type' })
  txnType: StockTxnType;

  @Column({ name: 'qty_delta', type: 'numeric', precision: 14, scale: 3 })
  qtyDelta: number;

  @Column({ name: 'work_order_id', type: 'uuid', nullable: true })
  workOrderId?: string;

  @Column({ type: 'text', nullable: true })
  reference?: string;

  @CreateDateColumn({ name: 'at', type: 'timestamptz' })
  at: Date;

  @Column({ name: 'by_user', type: 'uuid', nullable: true })
  byUser?: string;
}
