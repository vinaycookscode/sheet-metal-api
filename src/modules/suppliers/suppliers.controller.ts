import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  @Get()
  @RequirePermission('supplier.read')
  list(@CurrentUser() user: AuthUser, @Query('search') search?: string) {
    return this.service.list(user.orgId, search);
  }

  @Get(':id')
  @RequirePermission('supplier.read')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.get(user.orgId, id);
  }

  @Post()
  @RequirePermission('supplier.write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSupplierDto) {
    return this.service.create(user.orgId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermission('supplier.write')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.service.update(user.orgId, user.userId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('supplier.delete')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.orgId, id);
  }
}
