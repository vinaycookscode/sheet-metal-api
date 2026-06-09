import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class PoLineDto {
  @IsUUID()
  itemId: string;

  @IsNumber()
  @Min(0)
  qty: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsUUID()
  taxCodeId?: string;
}

export class CreatePurchaseOrderDto {
  @IsUUID()
  supplierId: string;

  @IsOptional()
  @IsBoolean()
  isSubcontract?: boolean;

  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PoLineDto)
  lines: PoLineDto[];
}

export class RequisitionLineDto {
  @IsUUID()
  requisitionId: string;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsUUID()
  taxCodeId?: string;
}

export class FromRequisitionsDto {
  @IsUUID()
  supplierId: string;

  @IsOptional()
  @IsBoolean()
  isSubcontract?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RequisitionLineDto)
  lines: RequisitionLineDto[];
}

export class GrnLineDto {
  @IsUUID()
  poLineId: string;

  @IsNumber()
  @Min(0)
  qtyReceived: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  qtyRejected?: number;

  @IsOptional() @IsString() heatNo?: string;
  @IsOptional() @IsString() lotNo?: string;
  @IsOptional() @IsString() location?: string;
}

export class CreateGrnDto {
  @IsUUID()
  purchaseOrderId: string;

  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GrnLineDto)
  lines: GrnLineDto[];
}
