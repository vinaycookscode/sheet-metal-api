import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { DOWNTIME_REASONS, DowntimeReason } from '../../common/enums';

export class StartDowntimeDto {
  @IsUUID()
  workCenterId: string;

  @IsIn(DOWNTIME_REASONS)
  reason: DowntimeReason;

  @IsOptional()
  @IsUUID()
  woOperationId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

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
