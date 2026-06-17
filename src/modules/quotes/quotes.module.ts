import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quote } from './quote.entity';
import { QuoteVersion } from './quote-version.entity';
import { QuoteLine } from './quote-line.entity';
import { EstimateDetail } from './estimate-detail.entity';
import { Customer } from '../customers/customer.entity';
import { Org } from '../../common/tenancy/org.entity';
import { Plant } from '../../common/tenancy/plant.entity';
import { QuotesService } from './quotes.service';
import { QuoteDocumentService } from './quote-document.service';
import { QuoteEmailService } from './quote-email.service';
import { QuotesController } from './quotes.controller';
import { DocSequenceModule } from '../doc-sequence/doc-sequence.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote, QuoteVersion, QuoteLine, EstimateDetail, Customer, Org, Plant]),
    DocSequenceModule,
    NotificationsModule,
  ],
  controllers: [QuotesController],
  providers: [QuotesService, QuoteDocumentService, QuoteEmailService],
  exports: [QuotesService],
})
export class QuotesModule {}
