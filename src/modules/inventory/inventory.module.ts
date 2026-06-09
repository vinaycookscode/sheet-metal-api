import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockLot } from './stock-lot.entity';
import { StockTxn } from './stock-txn.entity';
import { MaterialAllocation } from './material-allocation.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

/**
 * Inventory foundation: stock lots, append-only stock_txn ledger, and material
 * allocations. The InventoryService is the posting engine used by GRN (receipts)
 * and work-order release (allocation). Full stock views / issue-to-WO land in
 * the dedicated inventory batch (SM-150/151).
 */
@Module({
  imports: [TypeOrmModule.forFeature([StockLot, StockTxn, MaterialAllocation])],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
