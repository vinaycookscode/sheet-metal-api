import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SalesOrdersService } from './sales-orders.service';
import { CreateSalesOrderDto, FromQuoteDto, SoStatusDto, UpdateSalesOrderDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('sales-orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sales-orders')
export class SalesOrdersController {
  constructor(private readonly service: SalesOrdersService) {}

  private scope(u: AuthUser) {
    return { orgId: u.orgId, plantId: u.plantId as string, userId: u.userId };
  }

  @Get()
  @RequirePermission('so.read')
  list(@CurrentUser() u: AuthUser, @Query('status') status?: string, @Query('customerId') customerId?: string) {
    return this.service.list(u.plantId as string, { status, customerId });
  }

  @Get(':id')
  @RequirePermission('so.read')
  get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.findOne(u.plantId as string, id);
  }

  @Get(':id/document')
  @RequirePermission('so.read')
  document(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.document(u.plantId as string, id);
  }

  @Post()
  @RequirePermission('so.write')
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateSalesOrderDto) {
    return this.service.create(this.scope(u), dto);
  }

  @Post('from-quote/:quoteVersionId')
  @RequirePermission('so.write')
  fromQuote(@CurrentUser() u: AuthUser, @Param('quoteVersionId') quoteVersionId: string, @Body() dto: FromQuoteDto) {
    return this.service.fromQuote(this.scope(u), quoteVersionId, dto);
  }

  @Patch(':id')
  @RequirePermission('so.write')
  update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateSalesOrderDto) {
    return this.service.update(this.scope(u), id, dto);
  }

  @Post(':id/status')
  @RequirePermission('so.write')
  status(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: SoStatusDto) {
    return this.service.setStatus(this.scope(u), id, dto);
  }
}
