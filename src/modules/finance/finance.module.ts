import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './invoice.entity';
import { InvoiceLine } from './invoice-line.entity';
import { Payment } from './payment.entity';
import { SupplierInvoice } from './supplier-invoice.entity';
import { VendorPayment } from './vendor-payment.entity';
import { InvoiceService } from './invoice.service';
import { PaymentService } from './payment.service';
import { ClosureService } from './closure.service';
import { ApService } from './ap.service';
import { InvoiceController, PaymentController, ClosureController, SupplierInvoiceController, VendorPaymentController } from './finance.controller';
import { DocSequenceModule } from '../doc-sequence/doc-sequence.module';

/**
 * Finance & closure (SM-164/165/166): GST tax invoice (CGST/SGST vs IGST by
 * place of supply), payments + AR aging, project closure with estimate-vs-
 * actual roll-up, and Accounts Payable (supplier invoice + 3-way match + vendor
 * payments + AP aging — SM-241/242/243).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoiceLine, Payment, SupplierInvoice, VendorPayment]), DocSequenceModule],
  controllers: [InvoiceController, PaymentController, ClosureController, SupplierInvoiceController, VendorPaymentController],
  providers: [InvoiceService, PaymentService, ClosureService, ApService],
  exports: [InvoiceService, PaymentService, ClosureService],
})
export class FinanceModule {}
