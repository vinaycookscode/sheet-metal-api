import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query('unread') unread?: string, @Query('limit') limit?: string) {
    return this.service.list(u.userId, { unreadOnly: unread === 'true', limit: limit ? Number(limit) : undefined });
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() u: AuthUser) {
    return { count: await this.service.unreadCount(u.userId) };
  }

  @Post('read-all')
  readAll(@CurrentUser() u: AuthUser) {
    return this.service.markAllRead(u.userId);
  }

  @Post(':id/read')
  read(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.markRead(u.userId, id);
  }
}
