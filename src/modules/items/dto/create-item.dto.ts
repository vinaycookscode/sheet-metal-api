import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { ITEM_TYPES, ItemType } from '../../../common/enums';

export class CreateItemDto {
  @IsString()
  @Length(1, 40)
  code: string;

  @IsString()
  name: string;

  @IsIn(ITEM_TYPES)
  itemType: ItemType;

  @IsUUID()
  uomId: string;

  @IsOptional()
  @IsUUID()
  taxCodeId?: string;

  @IsOptional()
  @IsUUID()
  materialGradeId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  thicknessMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sheetLengthMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sheetWidthMm?: number;

  @IsOptional()
  @IsBoolean()
  isTraceable?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stdCost?: number;
}
