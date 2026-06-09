import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { GST_TREATMENTS, GstTreatment, SO_STATUSES, SoStatus } from '../../common/enums';

export class SoLineDto {
  @IsString()
  partName: string;

  @IsNumber()
  @Min(0)
  qty: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsDateString()
  promisedDate?: string;

  @IsOptional()
  @IsUUID()
  taxCodeId?: string;

  @IsOptional()
  @IsUUID()
  quoteLineId?: string;
}

export class CreateSalesOrderDto {
  @IsUUID()
  customerId: string;

  @IsOptional()
  @IsString()
  customerPoNumber?: string;

  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SoLineDto)
  lines: SoLineDto[];
}

export class FromQuoteDto {
  @IsOptional()
  @IsString()
  customerPoNumber?: string;
}

export class UpdateSalesOrderDto {
  @IsOptional()
  @IsString()
  customerPoNumber?: string;

  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @IsOptional()
  @IsIn(GST_TREATMENTS)
  gstTreatment?: GstTreatment;
}

export class SoStatusDto {
  @IsIn(SO_STATUSES)
  status: SoStatus;
}
