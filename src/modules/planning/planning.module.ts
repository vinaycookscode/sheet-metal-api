import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkOrder } from './work-order.entity';
import { WoOperation } from './wo-operation.entity';
import { PurchaseRequisition } from './purchase-requisition.entity';
import { MrpService } from './mrp.service';
import { WorkOrdersService } from './work-orders.service';
import { PlanningController } from './planning.controller';
import { DocSequenceModule } from '../doc-sequence/doc-sequence.module';
import { EngineeringModule } from '../engineering/engineering.module';
import { InventoryModule } from '../inventory/inventory.module';

/**
 * Planning (SM-140/141): MRP run (plan WOs + requisitions from released SO
 * lines, netting against on-hand/on-order) and work-order release (operations
 * from routing + material allocation). Depends on Engineering (BOM explode),
 * Inventory (stock netting/allocation), and DocSequence (WO numbering).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([WorkOrder, WoOperation, PurchaseRequisition]),
    DocSequenceModule,
    EngineeringModule,
    InventoryModule,
  ],
  controllers: [PlanningController],
  providers: [MrpService, WorkOrdersService],
  exports: [MrpService, WorkOrdersService],
})
export class PlanningModule {}
