import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { BulkCreateProjectsDto, CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  @RequirePermission('project.read')
  list(
    @CurrentUser() user: AuthUser,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.service.list(user.orgId, { customerId, status, search });
  }

  @Get(':id')
  @RequirePermission('project.read')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.get(user.orgId, id);
  }

  @Get(':id/summary')
  @RequirePermission('project.read')
  summary(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.summary(user.orgId, id);
  }

  @Post()
  @RequirePermission('project.write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.service.create(user.orgId, user.plantId as string, user.userId, dto);
  }

  @Post('bulk')
  @RequirePermission('project.write')
  bulk(@CurrentUser() user: AuthUser, @Body() dto: BulkCreateProjectsDto) {
    return this.service.bulkCreate(user.orgId, user.plantId as string, user.userId, dto.projects);
  }

  @Patch(':id')
  @RequirePermission('project.write')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.service.update(user.orgId, user.userId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('project.write')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.orgId, id);
  }
}
