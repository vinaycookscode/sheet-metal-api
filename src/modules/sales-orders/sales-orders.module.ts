import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesOrder } from './sales-order.entity';
import { SoLine } from './so-line.entity';
import { SalesOrdersService } from './sales-orders.service';
import { SalesOrdersController } from './sales-orders.controller';
import { DocSequenceModule } from '../doc-sequence/doc-sequence.module';

@Module({
  imports: [TypeOrmModule.forFeature([SalesOrder, SoLine]), DocSequenceModule],
  controllers: [SalesOrdersController],
  providers: [SalesOrdersService],
  exports: [SalesOrdersService],
})
export class SalesOrdersModule {}
