import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class PackingLineDto {
  @IsUUID()
  soLineId: string;

  @IsNumber()
  @Min(0)
  qty: number;

  @IsOptional() @IsString() boxNo?: string;
  @IsOptional() @IsNumber() @Min(0) weightKg?: number;
}

export class CreateShipmentDto {
  @IsUUID()
  salesOrderId: string;

  @IsOptional() @IsDateString() dispatchDate?: string;
  @IsOptional() @IsString() carrier?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PackingLineDto)
  lines: PackingLineDto[];
}

export class DispatchShipmentDto {
  @IsOptional() @IsString() carrier?: string;
  @IsOptional() @IsString() trackingNo?: string;
  @IsOptional() @IsDateString() dispatchDate?: string;
  @IsOptional() @IsNumber() @Min(0) freightCost?: number;
}

export class EwayBillDto {
  @IsNumber()
  @Min(0)
  value: number;

  @IsInt()
  @Min(1)
  distanceKm: number;

  @IsString()
  vehicleNo: string;
}
