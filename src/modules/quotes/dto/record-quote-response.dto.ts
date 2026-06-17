import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { QUOTE_REJECT_REASONS } from '../../../common/enums';

export const QUOTE_RESPONSE_ACTIONS = ['accept', 'reject', 'negotiate', 'follow_up', 'note'] as const;
export type QuoteResponseAction = (typeof QUOTE_RESPONSE_ACTIONS)[number];

export class RecordQuoteResponseDto {
  @IsIn(QUOTE_RESPONSE_ACTIONS)
  action: QuoteResponseAction;

  /** Required-ish when action = reject (a reason code). */
  @IsOptional()
  @IsIn(QUOTE_REJECT_REASONS)
  rejectReason?: string;

  /** Customer's proposed total when bargaining. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  counterAmount?: number;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsDateString()
  nextFollowUpDate?: string;
}
