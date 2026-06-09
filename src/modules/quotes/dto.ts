import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ESTIMATE_DETAIL_TYPES, EstimateDetailType } from '../../common/enums';

export class EstimateDetailDto {
  @IsIn(ESTIMATE_DETAIL_TYPES)
  detailType: EstimateDetailType;

  @IsOptional()
  @IsUUID()
  refId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  qty?: number;

  @IsOptional()
  @IsNumber()
  rate?: number;

  @IsOptional()
  @IsNumber()
  yieldPct?: number;

  @IsNumber()
  amount: number;
}

export class QuoteLineInputDto {
  @IsString()
  partName: string;

  @IsNumber()
  @Min(0)
  primaryQty: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsArray()
  qtyBreakPrices?: Array<{ qty: number; price: number }>;

  @IsOptional() @IsNumber() @Min(0) materialCost?: number;
  @IsOptional() @IsNumber() @Min(0) processCost?: number;
  @IsOptional() @IsNumber() @Min(0) hardwareCost?: number;
  @IsOptional() @IsNumber() @Min(0) outsideCost?: number;
  @IsOptional() @IsNumber() @Min(0) setupCost?: number;

  @IsOptional()
  @IsUUID()
  taxCodeId?: string;

  @IsOptional()
  @IsUUID()
  inquiryLineId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EstimateDetailDto)
  estimateDetails?: EstimateDetailDto[];
}

export class CreateQuoteDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  inquiryId?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDays?: number;

  @IsOptional()
  @IsNumber()
  markupPct?: number;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteLineInputDto)
  lines?: QuoteLineInputDto[];
}

export class ReviseQuoteDto {
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsInt() @Min(0) leadTimeDays?: number;
  @IsOptional() @IsNumber() markupPct?: number;
  @IsOptional() @IsString() terms?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteLineInputDto)
  lines?: QuoteLineInputDto[];
}

export class QuoteStatusDto {
  @IsIn(['sent', 'accepted', 'rejected', 'expired'])
  status: 'sent' | 'accepted' | 'rejected' | 'expired';

  @IsOptional()
  @IsString()
  winLossReason?: string;
}
