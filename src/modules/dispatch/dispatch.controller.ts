import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DispatchService } from './dispatch.service';
import { CreateShipmentDto, DispatchShipmentDto, EwayBillDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('dispatch')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('shipments')
export class DispatchController {
  constructor(private readonly service: DispatchService) {}

  private scope(u: AuthUser) {
    return { plantId: u.plantId as string, userId: u.userId };
  }

  @Get()
  @RequirePermission('dispatch.read')
  list(@CurrentUser() u: AuthUser, @Query('status') status?: string, @Query('salesOrderId') salesOrderId?: string) {
    return this.service.list(u.plantId as string, { status, salesOrderId });
  }

  @Get(':id')
  @RequirePermission('dispatch.read')
  get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.findOne(u.plantId as string, id);
  }

  @Get(':id/challan')
  @RequirePermission('dispatch.read')
  challan(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.challan(u.plantId as string, id);
  }

  @Get(':id/document')
  @RequirePermission('dispatch.read')
  document(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.document(u.plantId as string, id);
  }

  @Get(':id/certificate')
  @RequirePermission('dispatch.read')
  certificate(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.certificate(u.plantId as string, id);
  }

  @Get(':id/dossier')
  @RequirePermission('dispatch.read')
  dossier(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.dossier(u.plantId as string, u.orgId, id);
  }

  @Get(':id/eway-bill')
  @RequirePermission('dispatch.read')
  getEway(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.getEwayBill(u.plantId as string, id);
  }

  @Post()
  @RequirePermission('dispatch.write')
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateShipmentDto) {
    return this.service.create(this.scope(u), dto);
  }

  @Post(':id/pack')
  @RequirePermission('dispatch.write')
  pack(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.pack(this.scope(u), id);
  }

  @Post(':id/dispatch')
  @RequirePermission('dispatch.write')
  dispatch(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DispatchShipmentDto) {
    return this.service.dispatch(this.scope(u), id, dto);
  }

  @Post(':id/eway-bill')
  @RequirePermission('eway.write')
  generateEway(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: EwayBillDto) {
    return this.service.generateEwayBill(this.scope(u), id, dto);
  }
}
