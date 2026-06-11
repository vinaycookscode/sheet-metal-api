import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RfqService } from './rfq.service';
import { AddRfqQuoteDto, AwardRfqDto, CreateRfqDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('rfqs')
export class RfqController {
  constructor(private readonly service: RfqService) {}

  private scope(u: AuthUser) {
    return { orgId: u.orgId, plantId: u.plantId as string, userId: u.userId };
  }

  @Get()
  @RequirePermission('po.read')
  list(@CurrentUser() u: AuthUser) {
    return this.service.list(u.plantId as string);
  }

  @Post()
  @RequirePermission('po.write')
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateRfqDto) {
    return this.service.create(this.scope(u), dto);
  }

  @Get(':id')
  @RequirePermission('po.read')
  get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.get(u.plantId as string, id);
  }

  @Get(':id/compare')
  @RequirePermission('po.read')
  compare(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.compare(u.plantId as string, id);
  }

  @Post(':id/quotes')
  @RequirePermission('po.write')
  addQuote(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: AddRfqQuoteDto) {
    return this.service.addQuote(u.plantId as string, id, dto);
  }

  @Post(':id/award')
  @RequirePermission('po.write')
  award(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: AwardRfqDto) {
    return this.service.award(this.scope(u), id, dto.supplierId);
  }
}
