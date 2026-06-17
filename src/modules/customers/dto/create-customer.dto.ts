import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsEmail,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

// GSTIN: 2-digit state + 10-char PAN + entity + Z + checksum
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export class CreateCustomerDto {
  /** Optional — auto-allocated (CUST-...) when omitted. */
  @IsOptional()
  @IsString()
  @Length(1, 24)
  code?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;

  @IsOptional()
  @Matches(GSTIN_RE, { message: 'Invalid GSTIN format' })
  gstin?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  stateCode?: string;

  @IsOptional()
  @IsObject()
  billingAddress?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  shippingAddress?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  paymentTermsDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;
}

/** Bulk create — add several customers in one call (each gets an auto code when omitted). */
export class BulkCreateCustomersDto {
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateCustomerDto)
  customers: CreateCustomerDto[];
}
