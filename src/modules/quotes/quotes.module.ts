import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quote } from './quote.entity';
import { QuoteVersion } from './quote-version.entity';
import { QuoteLine } from './quote-line.entity';
import { EstimateDetail } from './estimate-detail.entity';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { DocSequenceModule } from '../doc-sequence/doc-sequence.module';

@Module({
  imports: [TypeOrmModule.forFeature([Quote, QuoteVersion, QuoteLine, EstimateDetail]), DocSequenceModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
