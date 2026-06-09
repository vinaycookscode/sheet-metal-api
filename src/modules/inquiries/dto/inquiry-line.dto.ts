import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class InquiryLineDto {
  @IsString()
  partName: string;

  @IsNumber()
  @Min(0)
  qty: number;

  @IsOptional()
  @IsUUID()
  materialGradeId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  thicknessMm?: number;

  @IsOptional()
  @IsUUID()
  finishId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetPrice?: number;
}
