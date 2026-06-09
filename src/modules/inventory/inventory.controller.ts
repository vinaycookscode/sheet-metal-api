import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { AdjustStockDto, IssueToWoDto, ReturnRemnantDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('stock')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  private scope(u: AuthUser) {
    return { plantId: u.plantId as string, userId: u.userId };
  }

  /** Stock lots for the caller's plant (optionally filtered by item). */
  @Get()
  @RequirePermission('stock.read')
  list(@CurrentUser() u: AuthUser, @Query('itemId') itemId?: string) {
    return this.service.listStock(u.plantId as string, itemId);
  }

  @Get('summary')
  @RequirePermission('stock.read')
  summary(@CurrentUser() u: AuthUser) {
    return this.service.summary(u.plantId as string);
  }

  @Get('ledger')
  @RequirePermission('stock.read')
  ledger(@CurrentUser() u: AuthUser, @Query('itemId') itemId?: string, @Query('stockLotId') stockLotId?: string) {
    return this.service.ledger(u.plantId as string, { itemId, stockLotId });
  }

  @Post('issue')
  @RequirePermission('stock.write')
  issue(@CurrentUser() u: AuthUser, @Body() dto: IssueToWoDto) {
    return this.service.issueToWorkOrder(this.scope(u), dto.workOrderId);
  }

  @Post('return-remnant')
  @RequirePermission('stock.write')
  returnRemnant(@CurrentUser() u: AuthUser, @Body() dto: ReturnRemnantDto) {
    return this.service.returnRemnant(this.scope(u), dto);
  }

  @Post('adjust')
  @RequirePermission('stock.write')
  adjust(@CurrentUser() u: AuthUser, @Body() dto: AdjustStockDto) {
    return this.service.adjust(this.scope(u), dto);
  }
}
