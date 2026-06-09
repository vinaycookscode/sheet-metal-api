import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './invoice.entity';
import { InvoiceLine } from './invoice-line.entity';
import { Payment } from './payment.entity';
import { InvoiceService } from './invoice.service';
import { PaymentService } from './payment.service';
import { ClosureService } from './closure.service';
import { InvoiceController, PaymentController, ClosureController } from './finance.controller';
import { DocSequenceModule } from '../doc-sequence/doc-sequence.module';

/**
 * Finance & closure (SM-164/165/166): GST tax invoice (CGST/SGST vs IGST by
 * place of supply), payments + AR aging, and project closure with estimate-vs-
 * actual roll-up (via the v_wo_actual_cost view).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoiceLine, Payment]), DocSequenceModule],
  controllers: [InvoiceController, PaymentController, ClosureController],
  providers: [InvoiceService, PaymentService, ClosureService],
  exports: [InvoiceService, PaymentService, ClosureService],
})
export class FinanceModule {}
