import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './customer.entity';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { DocSequenceModule } from '../doc-sequence/doc-sequence.module';

@Module({
  imports: [TypeOrmModule.forFeature([Customer]), DocSequenceModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
