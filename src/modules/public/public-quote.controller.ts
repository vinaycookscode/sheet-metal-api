import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PublicQuoteService } from './public-quote.service';
import { PublicRespondDto } from './dto/public-respond.dto';

/**
 * Public, UNAUTHENTICATED endpoints for the customer quote link. Access is gated only
 * by the unguessable token; the view never exposes internal cost/margin data.
 * (Global ThrottlerGuard still rate-limits these.)
 */
@ApiTags('public')
@Controller('public/quotes')
export class PublicQuoteController {
  constructor(private readonly svc: PublicQuoteService) {}

  @Get(':token')
  view(@Param('token') token: string) {
    return this.svc.view(token);
  }

  @Post(':token/respond')
  respond(@Param('token') token: string, @Body() dto: PublicRespondDto) {
    return this.svc.respond(token, dto);
  }
}
