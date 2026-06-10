import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inspection } from './inspection.entity';
import { InspectionChar } from './inspection-char.entity';
import { Ncr } from './ncr.entity';
import { InspectionsService } from './inspections.service';
import { NcrService } from './ncr.service';
import { InspectionsController, NcrController } from './quality.controller';
import { DocSequenceModule } from '../doc-sequence/doc-sequence.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Quality (SM-160/161): final inspection with measured-vs-tolerance evaluation,
 * and NCR raise → disposition → close. Exposed for the dispatch gate (open
 * critical NCRs / failed final inspection block shipment) in the next batch.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Inspection, InspectionChar, Ncr]), DocSequenceModule, NotificationsModule],
  controllers: [InspectionsController, NcrController],
  providers: [InspectionsService, NcrService],
  exports: [InspectionsService, NcrService],
})
export class QualityModule {}
