import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { PoLine } from './po-line.entity';
import { Grn } from './grn.entity';
import { GrnLine } from './grn-line.entity';
import { PurchaseOrdersService } from './purchase-orders.service';
import { GrnService } from './grn.service';
import { ProcurementController } from './procurement.controller';
import { DocSequenceModule } from '../doc-sequence/doc-sequence.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PlanningModule } from '../planning/planning.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Procurement (SM-142/143): requisition→PO with approval lifecycle, and GRN
 * against PO that posts stock and updates PO fulfilment. Depends on DocSequence
 * (PO/GRN numbering), Inventory (stock posting), Planning (mark requisitions ordered).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseOrder, PoLine, Grn, GrnLine]),
    DocSequenceModule,
    InventoryModule,
    PlanningModule,
    NotificationsModule,
  ],
  controllers: [ProcurementController],
  providers: [PurchaseOrdersService, GrnService],
  exports: [PurchaseOrdersService, GrnService],
})
export class ProcurementModule {}
