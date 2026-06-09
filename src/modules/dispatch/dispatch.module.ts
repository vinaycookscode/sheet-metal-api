import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shipment } from './shipment.entity';
import { PackingLine } from './packing-line.entity';
import { EwayBill } from './eway-bill.entity';
import { DispatchService } from './dispatch.service';
import { DispatchController } from './dispatch.controller';
import { DocSequenceModule } from '../doc-sequence/doc-sequence.module';

/**
 * Dispatch (SM-162/163): shipment / delivery challan with a QC gate (open
 * critical NCRs + failed final inspections block it), packing list, and GST
 * e-way bill generation. Reads quality/sales tables via the shared DataSource.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Shipment, PackingLine, EwayBill]), DocSequenceModule],
  controllers: [DispatchController],
  providers: [DispatchService],
  exports: [DispatchService],
})
export class DispatchModule {}
