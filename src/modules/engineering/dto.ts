import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

export class RoutingOpDto {
  @IsOptional() @IsUUID() operationId?: string;
  @IsOptional() @IsUUID() workCenterId?: string;
  @IsOptional() @IsNumber() @Min(0) setupMinutes?: number;
  @IsOptional() @IsNumber() @Min(0) runSecondsPerUnit?: number;
  @IsOptional() @IsBoolean() isOutside?: boolean;
  @IsOptional() @IsString() instructions?: string;
}

export class BomLineDto {
  @IsOptional() @IsUUID() componentItemId?: string;
  @IsOptional() @IsUUID() componentPartId?: string;

  @IsNumber()
  @Min(0)
  qtyPer: number;

  @IsOptional() @IsNumber() @Min(0) scrapPct?: number;
}

export class CreatePartDto {
  @IsString()
  @Length(1, 40)
  partNo: string;

  @IsOptional()
  @IsString()
  @Length(1, 8)
  rev?: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() materialGradeId?: string;
  @IsOptional() @IsNumber() @Min(0) thicknessMm?: number;
  @IsOptional() @IsUUID() finishId?: string;
  @IsOptional() @IsNumber() @Min(0) flatLengthMm?: number;
  @IsOptional() @IsNumber() @Min(0) flatWidthMm?: number;
  @IsOptional() @IsInt() @Min(0) bendCount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutingOpDto)
  routing?: RoutingOpDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BomLineDto)
  bom?: BomLineDto[];
}

/** Header patch — part_no/rev are identity and changed only via new-rev. */
export class UpdatePartDto {
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() materialGradeId?: string;
  @IsOptional() @IsNumber() @Min(0) thicknessMm?: number;
  @IsOptional() @IsUUID() finishId?: string;
  @IsOptional() @IsNumber() @Min(0) flatLengthMm?: number;
  @IsOptional() @IsNumber() @Min(0) flatWidthMm?: number;
  @IsOptional() @IsInt() @Min(0) bendCount?: number;
}

export class ReplaceRoutingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutingOpDto)
  routing: RoutingOpDto[];
}

export class ReplaceBomDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BomLineDto)
  bom: BomLineDto[];
}

export class NewRevisionDto {
  @IsOptional()
  @IsString()
  @Length(1, 8)
  rev?: string;
}

export class ReleasePartDto {
  /** Optionally bind this released part to an SO line (status -> released_to_plan). */
  @IsOptional()
  @IsUUID()
  soLineId?: string;
}
