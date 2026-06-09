import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MrpService } from './mrp.service';
import { WorkOrdersService } from './work-orders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('planning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class PlanningController {
  constructor(
    private readonly mrp: MrpService,
    private readonly workOrders: WorkOrdersService,
  ) {}

  private scope(u: AuthUser) {
    return { orgId: u.orgId, plantId: u.plantId as string, userId: u.userId };
  }

  /** Run MRP for the plant (SM-140): plan WOs + purchase requisitions from released SO lines. */
  @Post('mrp/run')
  @RequirePermission('mrp.run')
  runMrp(@CurrentUser() u: AuthUser) {
    return this.mrp.run(this.scope(u));
  }

  @Get('purchase-requisitions')
  @RequirePermission('req.read')
  requisitions(@CurrentUser() u: AuthUser, @Query('ordered') ordered?: string) {
    return this.mrp.listRequisitions(u.plantId as string, { ordered });
  }

  @Get('work-orders')
  @RequirePermission('wo.read')
  listWo(@CurrentUser() u: AuthUser, @Query('status') status?: string) {
    return this.workOrders.list(u.plantId as string, { status });
  }

  @Get('work-orders/:id')
  @RequirePermission('wo.read')
  getWo(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.workOrders.findOne(u.plantId as string, id);
  }

  @Post('work-orders/:id/release')
  @RequirePermission('wo.release')
  releaseWo(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.workOrders.release(this.scope(u), id);
  }
}
