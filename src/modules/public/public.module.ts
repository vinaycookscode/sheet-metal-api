import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quote } from '../quotes/quote.entity';
import { QuotesModule } from '../quotes/quotes.module';
import { PublicQuoteController } from './public-quote.controller';
import { PublicQuoteService } from './public-quote.service';

/** Unauthenticated, token-gated customer endpoints (quote response link). */
@Module({
  imports: [TypeOrmModule.forFeature([Quote]), QuotesModule],
  controllers: [PublicQuoteController],
  providers: [PublicQuoteService],
})
export class PublicModule {}
