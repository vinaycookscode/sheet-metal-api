import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import {
  FinishService,
  MaterialGradeService,
  OperationService,
  TaxCodeService,
  UomService,
  WorkCenterService,
} from './services';
import {
  CreateFinishDto,
  CreateMaterialGradeDto,
  CreateOperationDto,
  CreateTaxCodeDto,
  CreateUomDto,
  CreateWorkCenterDto,
  UpdateFinishDto,
  UpdateMaterialGradeDto,
  UpdateOperationDto,
  UpdateTaxCodeDto,
  UpdateUomDto,
  UpdateWorkCenterDto,
} from './dto';

const READ = 'masterdata.read';
const WRITE = 'masterdata.write';
const DELETE = 'masterdata.delete';

// --- global lookups (no tenancy) -----------------------------------------
@ApiTags('master-data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('uoms')
export class UomController {
  constructor(private readonly service: UomService) {}
  @Get() @RequirePermission(READ) list(@Query('search') s?: string) { return this.service.list(undefined, s); }
  @Get(':id') @RequirePermission(READ) get(@Param('id') id: string) { return this.service.get(undefined, id); }
  @Post() @RequirePermission(WRITE) create(@CurrentUser() u: AuthUser, @Body() dto: CreateUomDto) { return this.service.create(undefined, u.userId, dto); }
  @Patch(':id') @RequirePermission(WRITE) update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateUomDto) { return this.service.update(undefined, u.userId, id, dto); }
  @Delete(':id') @RequirePermission(DELETE) remove(@Param('id') id: string) { return this.service.remove(undefined, id); }
}

@ApiTags('master-data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tax-codes')
export class TaxCodeController {
  constructor(private readonly service: TaxCodeService) {}
  @Get() @RequirePermission(READ) list(@Query('search') s?: string) { return this.service.list(undefined, s); }
  @Get(':id') @RequirePermission(READ) get(@Param('id') id: string) { return this.service.get(undefined, id); }
  @Post() @RequirePermission(WRITE) create(@CurrentUser() u: AuthUser, @Body() dto: CreateTaxCodeDto) { return this.service.create(undefined, u.userId, dto); }
  @Patch(':id') @RequirePermission(WRITE) update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateTaxCodeDto) { return this.service.update(undefined, u.userId, id, dto); }
  @Delete(':id') @RequirePermission(DELETE) remove(@Param('id') id: string) { return this.service.remove(undefined, id); }
}

// --- org-scoped masters --------------------------------------------------
@ApiTags('master-data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('material-grades')
export class MaterialGradeController {
  constructor(private readonly service: MaterialGradeService) {}
  @Get() @RequirePermission(READ) list(@CurrentUser() u: AuthUser, @Query('search') s?: string) { return this.service.list(u.orgId, s); }
  @Get(':id') @RequirePermission(READ) get(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.get(u.orgId, id); }
  @Post() @RequirePermission(WRITE) create(@CurrentUser() u: AuthUser, @Body() dto: CreateMaterialGradeDto) { return this.service.create(u.orgId, u.userId, dto); }
  @Patch(':id') @RequirePermission(WRITE) update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateMaterialGradeDto) { return this.service.update(u.orgId, u.userId, id, dto); }
  @Delete(':id') @RequirePermission(DELETE) remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.remove(u.orgId, id); }
}

@ApiTags('master-data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finishes')
export class FinishController {
  constructor(private readonly service: FinishService) {}
  @Get() @RequirePermission(READ) list(@CurrentUser() u: AuthUser, @Query('search') s?: string) { return this.service.list(u.orgId, s); }
  @Get(':id') @RequirePermission(READ) get(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.get(u.orgId, id); }
  @Post() @RequirePermission(WRITE) create(@CurrentUser() u: AuthUser, @Body() dto: CreateFinishDto) { return this.service.create(u.orgId, u.userId, dto); }
  @Patch(':id') @RequirePermission(WRITE) update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateFinishDto) { return this.service.update(u.orgId, u.userId, id, dto); }
  @Delete(':id') @RequirePermission(DELETE) remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.remove(u.orgId, id); }
}

@ApiTags('master-data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('operations')
export class OperationController {
  constructor(private readonly service: OperationService) {}
  @Get() @RequirePermission(READ) list(@CurrentUser() u: AuthUser, @Query('search') s?: string) { return this.service.list(u.orgId, s); }
  @Get(':id') @RequirePermission(READ) get(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.get(u.orgId, id); }
  @Post() @RequirePermission(WRITE) create(@CurrentUser() u: AuthUser, @Body() dto: CreateOperationDto) { return this.service.create(u.orgId, u.userId, dto); }
  @Patch(':id') @RequirePermission(WRITE) update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateOperationDto) { return this.service.update(u.orgId, u.userId, id, dto); }
  @Delete(':id') @RequirePermission(DELETE) remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.remove(u.orgId, id); }
}

// --- plant-scoped masters ------------------------------------------------
@ApiTags('master-data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('work-centers')
export class WorkCenterController {
  constructor(private readonly service: WorkCenterService) {}
  @Get() @RequirePermission(READ) list(@CurrentUser() u: AuthUser, @Query('search') s?: string) { return this.service.list(u.plantId, s); }
  @Get(':id') @RequirePermission(READ) get(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.get(u.plantId, id); }
  @Post() @RequirePermission(WRITE) create(@CurrentUser() u: AuthUser, @Body() dto: CreateWorkCenterDto) { return this.service.create(u.plantId, u.userId, dto); }
  @Patch(':id') @RequirePermission(WRITE) update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateWorkCenterDto) { return this.service.update(u.plantId, u.userId, id, dto); }
  @Delete(':id') @RequirePermission(DELETE) remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.remove(u.plantId, id); }
}

export const MASTER_DATA_CONTROLLERS = [
  UomController,
  TaxCodeController,
  MaterialGradeController,
  FinishController,
  OperationController,
  WorkCenterController,
];
