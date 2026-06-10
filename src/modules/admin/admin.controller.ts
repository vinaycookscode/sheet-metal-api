import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CreateRoleDto, CreateUserDto, ResetPasswordDto, SetPermissionsDto, SetRolesDto, UpdateUserDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

const READ = 'identity.read';
const WRITE = 'identity.write';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('users') @RequirePermission(READ)
  listUsers(@CurrentUser() u: AuthUser) {
    return this.service.listUsers(u.orgId);
  }
  @Post('users') @RequirePermission(WRITE)
  createUser(@CurrentUser() u: AuthUser, @Body() dto: CreateUserDto) {
    return this.service.createUser(u.orgId, dto);
  }
  @Patch('users/:id') @RequirePermission(WRITE)
  updateUser(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.service.updateUser(u.orgId, id, dto);
  }
  @Put('users/:id/roles') @RequirePermission(WRITE)
  setRoles(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: SetRolesDto) {
    return this.service.setUserRoles(u.orgId, id, dto);
  }
  @Post('users/:id/reset-password') @RequirePermission(WRITE)
  resetPassword(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.service.resetPassword(u.orgId, id, dto.password);
  }

  @Get('roles') @RequirePermission(READ)
  listRoles(@CurrentUser() u: AuthUser) {
    return this.service.listRoles(u.orgId);
  }
  @Post('roles') @RequirePermission(WRITE)
  createRole(@CurrentUser() u: AuthUser, @Body() dto: CreateRoleDto) {
    return this.service.createRole(u.orgId, dto);
  }
  @Put('roles/:id/permissions') @RequirePermission(WRITE)
  setRolePermissions(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: SetPermissionsDto) {
    return this.service.setRolePermissions(u.orgId, id, dto);
  }

  @Get('permissions') @RequirePermission(READ)
  listPermissions() {
    return this.service.listPermissions();
  }
}
