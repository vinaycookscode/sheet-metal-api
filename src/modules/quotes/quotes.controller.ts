import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { QuotesService } from './quotes.service';
import { QuoteDocumentService } from './quote-document.service';
import { QuoteEmailService } from './quote-email.service';
import { CreateQuoteDto, QuoteStatusDto, ReviseQuoteDto } from './dto';
import { SendQuoteEmailDto } from './dto/send-quote-email.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('quotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly service: QuotesService,
    private readonly docs: QuoteDocumentService,
    private readonly email: QuoteEmailService,
  ) {}

  private scope(u: AuthUser) {
    return { orgId: u.orgId, plantId: u.plantId as string, userId: u.userId };
  }

  @Get()
  @RequirePermission('quote.read')
  list(@CurrentUser() u: AuthUser, @Query('status') status?: string, @Query('customerId') customerId?: string) {
    return this.service.list(u.plantId as string, { status, customerId });
  }

  @Get(':id')
  @RequirePermission('quote.read')
  get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.findOne(u.plantId as string, id);
  }

  @Get(':id/document')
  @RequirePermission('quote.read')
  document(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.docs.model(u.plantId as string, id);
  }

  @Post(':id/send-email')
  @RequirePermission('quote.write')
  sendEmail(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: SendQuoteEmailDto) {
    return this.email.send(this.scope(u), id, dto);
  }

  @Post()
  @RequirePermission('quote.write')
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateQuoteDto) {
    return this.service.create(this.scope(u), dto);
  }

  @Post(':id/revise')
  @RequirePermission('quote.write')
  revise(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ReviseQuoteDto) {
    return this.service.revise(this.scope(u), id, dto);
  }

  @Post(':id/status')
  @RequirePermission('quote.write')
  status(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: QuoteStatusDto) {
    return this.service.setStatus(this.scope(u), id, dto);
  }
}
