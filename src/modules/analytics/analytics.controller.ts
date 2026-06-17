import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('kpis')
  @RequirePermission('so.read')
  kpis(@CurrentUser() u: AuthUser) {
    return this.service.kpis(u.plantId as string);
  }

  @Get('profitability')
  @RequirePermission('so.read')
  profitability(@CurrentUser() u: AuthUser) {
    return this.service.profitability(u.plantId as string);
  }

  @Get('production')
  @RequirePermission('mes.read')
  production(@CurrentUser() u: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.productionIntelligence(u.plantId as string, from, to);
  }
}
