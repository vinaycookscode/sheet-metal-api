import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class InvoiceLineInputDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  qty: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional() @IsString() hsnSac?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  gstRate?: number;

  @IsOptional() @IsUUID() soLineId?: string;
}

export class CreateInvoiceDto {
  @IsUUID()
  customerId: string;

  @IsOptional() @IsUUID() salesOrderId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineInputDto)
  lines: InvoiceLineInputDto[];
}

export class RecordPaymentDto {
  @IsUUID()
  customerId: string;

  @IsOptional() @IsUUID() invoiceId?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsString() reference?: string;
}

export class CreateSupplierInvoiceDto {
  @IsOptional() @IsString() supplierRef?: string;
  @IsOptional() @IsDateString() invoiceDate?: string;
}

export class RecordVendorPaymentDto {
  @IsOptional() @IsUUID() supplierInvoiceId?: string;
  @IsOptional() @IsUUID() supplierId?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsString() reference?: string;
}
