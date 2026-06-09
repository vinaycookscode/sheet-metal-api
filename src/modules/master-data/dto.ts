import { PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { RATE_BASES, RateBasis } from '../../common/enums';

export class CreateUomDto {
  @IsString()
  @Length(1, 12)
  code: string;

  @IsString()
  name: string;
}
export class UpdateUomDto extends PartialType(CreateUomDto) {}

export class CreateTaxCodeDto {
  @IsString()
  @Length(1, 8)
  hsnSac: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  gstRate: number;
}
export class UpdateTaxCodeDto extends PartialType(CreateTaxCodeDto) {}

export class CreateMaterialGradeDto {
  @IsString()
  @Length(1, 24)
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  density?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultRate?: number;

  @IsOptional()
  @IsBoolean()
  isTraceable?: boolean;
}
export class UpdateMaterialGradeDto extends PartialType(CreateMaterialGradeDto) {}

export class CreateFinishDto {
  @IsString()
  @Length(1, 24)
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  isOutside?: boolean;
}
export class UpdateFinishDto extends PartialType(CreateFinishDto) {}

export class CreateWorkCenterDto {
  @IsString()
  @Length(1, 24)
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  capacityHrsPerDay?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @IsOptional()
  @IsBoolean()
  isOutside?: boolean;
}
export class UpdateWorkCenterDto extends PartialType(CreateWorkCenterDto) {}

export class CreateOperationDto {
  @IsString()
  @Length(1, 24)
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsUUID()
  defaultWorkCenterId?: string;

  @IsIn(RATE_BASES)
  rateBasis: RateBasis;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultRate?: number;
}
export class UpdateOperationDto extends PartialType(CreateOperationDto) {}
