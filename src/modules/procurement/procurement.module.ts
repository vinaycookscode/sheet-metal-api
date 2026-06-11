import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { PoLine } from './po-line.entity';
import { Grn } from './grn.entity';
import { GrnLine } from './grn-line.entity';
import { Rfq } from './rfq.entity';
import { RfqLine } from './rfq-line.entity';
import { RfqQuote } from './rfq-quote.entity';
import { PurchaseOrdersService } from './purchase-orders.service';
import { GrnService } from './grn.service';
import { RfqService } from './rfq.service';
import { ProcurementController } from './procurement.controller';
import { RfqController } from './rfq.controller';
import { DocSequenceModule } from '../doc-sequence/doc-sequence.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PlanningModule } from '../planning/planning.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Procurement (SM-142/143): requisition→PO with approval lifecycle, GRN against
 * PO that posts stock and updates PO fulfilment, and supplier RFQ → comparison →
 * award→PO (SM-240). Depends on DocSequence (PO/GRN/RFQ numbering), Inventory
 * (stock posting), Planning (mark requisitions ordered).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseOrder, PoLine, Grn, GrnLine, Rfq, RfqLine, RfqQuote]),
    DocSequenceModule,
    InventoryModule,
    PlanningModule,
    NotificationsModule,
  ],
  controllers: [ProcurementController, RfqController],
  providers: [PurchaseOrdersService, GrnService, RfqService],
  exports: [PurchaseOrdersService, GrnService],
})
export class ProcurementModule {}
