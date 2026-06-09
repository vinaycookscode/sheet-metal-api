import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EngineeringService } from './engineering.service';
import {
  CreatePartDto,
  NewRevisionDto,
  ReleasePartDto,
  ReplaceBomDto,
  ReplaceRoutingDto,
  UpdatePartDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('engineering')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('parts')
export class EngineeringController {
  constructor(private readonly service: EngineeringService) {}

  private scope(u: AuthUser) {
    return { orgId: u.orgId, plantId: u.plantId as string, userId: u.userId };
  }

  @Get()
  @RequirePermission('part.read')
  list(@CurrentUser() u: AuthUser, @Query('search') search?: string, @Query('released') released?: string) {
    return this.service.list(u.orgId, { search, released });
  }

  @Get(':id')
  @RequirePermission('part.read')
  get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.findOne(u.orgId, id);
  }

  @Get(':id/explode')
  @RequirePermission('part.read')
  explode(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query('qty') qty?: string) {
    return this.service.explode(u.orgId, id, Number(qty) > 0 ? Number(qty) : 1);
  }

  @Post()
  @RequirePermission('part.write')
  create(@CurrentUser() u: AuthUser, @Body() dto: CreatePartDto) {
    return this.service.create(this.scope(u), dto);
  }

  @Patch(':id')
  @RequirePermission('part.write')
  update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdatePartDto) {
    return this.service.updateHeader(this.scope(u), id, dto);
  }

  @Put(':id/routing')
  @RequirePermission('part.write')
  routing(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ReplaceRoutingDto) {
    return this.service.replaceRouting(this.scope(u), id, dto.routing);
  }

  @Put(':id/bom')
  @RequirePermission('part.write')
  bom(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ReplaceBomDto) {
    return this.service.replaceBom(this.scope(u), id, dto.bom);
  }

  @Post(':id/new-rev')
  @RequirePermission('part.write')
  newRev(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: NewRevisionDto) {
    return this.service.newRevision(this.scope(u), id, dto);
  }

  @Post(':id/release')
  @RequirePermission('part.release')
  release(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ReleasePartDto) {
    return this.service.release(this.scope(u), id, dto);
  }
}
