import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InspectionsService } from './inspections.service';
import { NcrService } from './ncr.service';
import { CreateInspectionDto, CreateNcrDto, DispositionDto, RecordInspectionDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

const scope = (u: AuthUser) => ({ orgId: u.orgId, plantId: u.plantId as string, userId: u.userId });

@ApiTags('quality')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inspections')
export class InspectionsController {
  constructor(private readonly service: InspectionsService) {}

  @Get()
  @RequirePermission('inspection.read')
  list(@CurrentUser() u: AuthUser, @Query('kind') kind?: string, @Query('result') result?: string, @Query('soLineId') soLineId?: string, @Query('workOrderId') workOrderId?: string) {
    return this.service.list(u.plantId as string, { kind, result, soLineId, workOrderId });
  }

  @Get(':id')
  @RequirePermission('inspection.read')
  get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.findOne(u.plantId as string, id);
  }

  @Post()
  @RequirePermission('inspection.write')
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateInspectionDto) {
    return this.service.create(scope(u), dto);
  }

  @Post(':id/record')
  @RequirePermission('inspection.write')
  record(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: RecordInspectionDto) {
    return this.service.record(scope(u), id, dto);
  }
}

@ApiTags('quality')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ncrs')
export class NcrController {
  constructor(private readonly service: NcrService) {}

  @Get()
  @RequirePermission('ncr.read')
  list(@CurrentUser() u: AuthUser, @Query('status') status?: string, @Query('critical') critical?: string) {
    return this.service.list(u.plantId as string, { status, critical });
  }

  @Get(':id')
  @RequirePermission('ncr.read')
  get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.findOne(u.plantId as string, id);
  }

  @Post()
  @RequirePermission('ncr.write')
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateNcrDto) {
    return this.service.create(scope(u), dto);
  }

  @Post(':id/disposition')
  @RequirePermission('ncr.write')
  disposition(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DispositionDto) {
    return this.service.disposition(scope(u), id, dto);
  }

  @Post(':id/close')
  @RequirePermission('ncr.write')
  close(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.close(scope(u), id);
  }
}
