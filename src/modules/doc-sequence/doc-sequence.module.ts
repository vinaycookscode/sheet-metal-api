import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocSequence } from './doc-sequence.entity';
import { DocSequenceService } from './doc-sequence.service';
import { DocSequenceController } from './doc-sequence.controller';

/**
 * Platform numbering service (SM-010). Exported so transactional modules
 * (inquiry, quote, SO, WO, PO, GRN, invoice, dispatch) can allocate their
 * document numbers within their own write transaction.
 */
@Module({
  imports: [TypeOrmModule.forFeature([DocSequence])],
  controllers: [DocSequenceController],
  providers: [DocSequenceService],
  exports: [DocSequenceService],
})
export class DocSequenceModule {}
