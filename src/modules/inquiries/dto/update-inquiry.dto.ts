import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { InquiryLineDto } from './inquiry-line.dto';

/** Header-only patch. Lines are replaced via PUT /inquiries/:id/lines. */
export class UpdateInquiryDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsDateString()
  requiredDate?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsUUID()
  estimatorId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReplaceLinesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InquiryLineDto)
  lines: InquiryLineDto[];
}

export class SendToEstimationDto {
  @IsUUID()
  estimatorId: string;
}

export class InquiryOutcomeDto {
  @IsIn(['won', 'lost'])
  status: 'won' | 'lost';

  @IsOptional()
  @IsString()
  lostReason?: string;
}
