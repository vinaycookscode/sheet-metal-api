import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LaborEntry } from './labor-entry.entity';
import { DowntimeEvent } from './downtime-event.entity';
import { ProductionService } from './production.service';
import { ProductionController } from './production.controller';

/**
 * Production / MES (SM-152/153/154): shop-floor clock on/off with good/scrap
 * capture (labor_entry), job traveler, and the live production board. Reads/
 * updates work_order + wo_operation (planning entities) via the shared DataSource.
 */
@Module({
  imports: [TypeOrmModule.forFeature([LaborEntry, DowntimeEvent])],
  controllers: [ProductionController],
  providers: [ProductionService],
  exports: [ProductionService],
})
export class ProductionModule {}
