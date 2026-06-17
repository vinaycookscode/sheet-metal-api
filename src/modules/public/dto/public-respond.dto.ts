import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { QUOTE_REJECT_REASONS } from '../../../common/enums';

/** What a customer can submit from the public quote link. */
export class PublicRespondDto {
  @IsIn(['accept', 'reject', 'negotiate'])
  action: 'accept' | 'reject' | 'negotiate';

  @IsOptional()
  @IsIn(QUOTE_REJECT_REASONS)
  rejectReason?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  counterAmount?: number;

  @IsOptional()
  @IsString()
  message?: string;
}
