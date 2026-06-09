import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProductionService } from './production.service';
import { ClockOffDto, ClockOnDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class ProductionController {
  constructor(private readonly service: ProductionService) {}

  private scope(u: AuthUser) {
    return { plantId: u.plantId as string, userId: u.userId };
  }

  @Post('production/clock-on')
  @RequirePermission('mes.clock')
  clockOn(@CurrentUser() u: AuthUser, @Body() dto: ClockOnDto) {
    return this.service.clockOn(this.scope(u), dto);
  }

  @Post('production/clock-off')
  @RequirePermission('mes.clock')
  clockOff(@CurrentUser() u: AuthUser, @Body() dto: ClockOffDto) {
    return this.service.clockOff(this.scope(u), dto);
  }

  @Get('production/board')
  @RequirePermission('mes.read')
  board(@CurrentUser() u: AuthUser, @Query('workCenterId') workCenterId?: string) {
    return this.service.board(u.plantId as string, workCenterId);
  }

  @Get('work-orders/:id/traveler')
  @RequirePermission('mes.read')
  traveler(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.traveler(u.plantId as string, id);
  }
}
