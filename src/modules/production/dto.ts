import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ClockOnDto {
  @IsUUID()
  woOperationId: string;
}

export class ClockOffDto {
  @IsUUID()
  woOperationId: string;

  @IsNumber()
  @Min(0)
  qtyGood: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  qtyScrap?: number;

  @IsOptional()
  @IsString()
  scrapReason?: string;

  @IsOptional()
  @IsBoolean()
  rework?: boolean;
}
