import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PurchaseOrdersService } from './purchase-orders.service';
import { GrnService } from './grn.service';
import { CreateGrnDto, CreatePurchaseOrderDto, FromRequisitionsDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class ProcurementController {
  constructor(
    private readonly po: PurchaseOrdersService,
    private readonly grn: GrnService,
  ) {}

  private scope(u: AuthUser) {
    return { orgId: u.orgId, plantId: u.plantId as string, userId: u.userId };
  }

  // --- purchase orders ---
  @Post('purchase-orders')
  @RequirePermission('po.write')
  createPo(@CurrentUser() u: AuthUser, @Body() dto: CreatePurchaseOrderDto) {
    return this.po.create(this.scope(u), dto);
  }

  @Post('purchase-orders/from-requisitions')
  @RequirePermission('po.write')
  fromReqs(@CurrentUser() u: AuthUser, @Body() dto: FromRequisitionsDto) {
    return this.po.fromRequisitions(this.scope(u), dto);
  }

  @Get('purchase-orders')
  @RequirePermission('po.read')
  listPo(@CurrentUser() u: AuthUser, @Query('status') status?: string, @Query('supplierId') supplierId?: string) {
    return this.po.list(u.plantId as string, { status, supplierId });
  }

  @Get('purchase-orders/:id')
  @RequirePermission('po.read')
  getPo(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.po.findOne(u.plantId as string, id);
  }

  @Get('purchase-orders/:id/document')
  @RequirePermission('po.read')
  poDocument(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.po.document(u.plantId as string, id);
  }

  @Post('purchase-orders/:id/approve')
  @RequirePermission('po.approve')
  approve(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.po.approve(this.scope(u), id);
  }

  @Post('purchase-orders/:id/send')
  @RequirePermission('po.write')
  send(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.po.send(this.scope(u), id);
  }

  // --- GRN ---
  @Post('grns')
  @RequirePermission('grn.write')
  createGrn(@CurrentUser() u: AuthUser, @Body() dto: CreateGrnDto) {
    return this.grn.create(this.scope(u), dto);
  }

  @Get('grns')
  @RequirePermission('grn.read')
  listGrn(@CurrentUser() u: AuthUser, @Query('purchaseOrderId') purchaseOrderId?: string) {
    return this.grn.list(u.plantId as string, { purchaseOrderId });
  }

  @Get('grns/:id')
  @RequirePermission('grn.read')
  getGrn(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.grn.findOne(u.plantId as string, id);
  }
}
