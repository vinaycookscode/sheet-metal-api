import { IsEmail, IsOptional, IsString } from 'class-validator';

export class SendQuoteEmailDto {
  /** Override recipient; defaults to the customer's email. */
  @IsOptional()
  @IsEmail({}, { message: 'Invalid recipient email' })
  to?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;
}
