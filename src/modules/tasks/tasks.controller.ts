import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly service: TasksService) {}

  /**
   * The caller's personal "what needs me now" feed. No specific permission —
   * any authenticated user — because the items are already scoped to what their
   * permissions let them see.
   */
  @Get('inbox')
  inbox(@CurrentUser() user: AuthUser) {
    return this.service.inbox(user);
  }
}
