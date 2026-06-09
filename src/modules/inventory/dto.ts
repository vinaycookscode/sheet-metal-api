import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class IssueToWoDto {
  @IsUUID()
  workOrderId: string;
}

export class ReturnRemnantDto {
  @IsUUID()
  workOrderId: string;

  @IsUUID()
  itemId: string;

  @IsNumber()
  qty: number;

  @IsOptional()
  @IsString()
  location?: string;
}

export class AdjustStockDto {
  @IsUUID()
  stockLotId: string;

  /** Signed delta applied to qty_on_hand (negative to write down). */
  @IsNumber()
  qtyDelta: number;

  @IsString()
  reason: string;
}
