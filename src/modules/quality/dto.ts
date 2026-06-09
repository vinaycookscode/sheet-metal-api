import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { INSPECTION_KINDS, InspectionKind, NCR_SOURCES, NcrSource } from '../../common/enums';

export class InspectionCharDto {
  @IsString()
  characteristic: string;

  @IsOptional() @IsNumber() nominal?: number;
  @IsOptional() @IsNumber() tolerancePlus?: number;
  @IsOptional() @IsNumber() toleranceMinus?: number;
}

export class CreateInspectionDto {
  @IsIn(INSPECTION_KINDS)
  kind: InspectionKind;

  @IsOptional() @IsUUID() workOrderId?: string;
  @IsOptional() @IsUUID() soLineId?: string;
  @IsOptional() @IsUUID() grnLineId?: string;
  @IsOptional() @IsString() notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InspectionCharDto)
  characteristics: InspectionCharDto[];
}

export class CharResultDto {
  @IsUUID()
  charId: string;

  @IsOptional() @IsNumber() measured?: number;
  @IsOptional() @IsIn(['pass', 'fail']) result?: 'pass' | 'fail';
}

export class RecordInspectionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CharResultDto)
  results: CharResultDto[];
}

export class CreateNcrDto {
  @IsIn(NCR_SOURCES)
  source: NcrSource;

  @IsOptional() @IsUUID() workOrderId?: string;
  @IsOptional() @IsUUID() stockLotId?: string;
  @IsOptional() @IsUUID() supplierId?: string;

  @IsString()
  defect: string;

  @IsOptional() @IsBoolean() isCritical?: boolean;
  @IsOptional() @IsNumber() @Min(0) costOfQuality?: number;
}

export class DispositionDto {
  @IsIn(['use_as_is', 'rework', 'scrap', 'return_to_supplier'])
  disposition: 'use_as_is' | 'rework' | 'scrap' | 'return_to_supplier';

  @IsOptional() @IsNumber() @Min(0) costOfQuality?: number;
}
