import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inquiry } from './inquiry.entity';
import { InquiryLine } from './inquiry-line.entity';
import { InquiriesService } from './inquiries.service';
import { InquiriesController } from './inquiries.controller';
import { DocSequenceModule } from '../doc-sequence/doc-sequence.module';

@Module({
  imports: [TypeOrmModule.forFeature([Inquiry, InquiryLine]), DocSequenceModule],
  controllers: [InquiriesController],
  providers: [InquiriesService],
  exports: [InquiriesService],
})
export class InquiriesModule {}
