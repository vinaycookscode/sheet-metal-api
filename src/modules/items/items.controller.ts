import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('items')
export class ItemsController {
  constructor(private readonly service: ItemsService) {}

  @Get()
  @RequirePermission('item.read')
  list(@CurrentUser() user: AuthUser, @Query('search') search?: string) {
    return this.service.list(user.orgId, search);
  }

  @Get(':id')
  @RequirePermission('item.read')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.get(user.orgId, id);
  }

  @Post()
  @RequirePermission('item.write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateItemDto) {
    return this.service.create(user.orgId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermission('item.write')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.service.update(user.orgId, user.userId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('item.delete')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.orgId, id);
  }
}
