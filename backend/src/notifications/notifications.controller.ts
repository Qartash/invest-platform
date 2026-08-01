import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

// Everything here is scoped to the caller inside the service — there is no route
// that reads or clears somebody else's notifications, not even for an admin.
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: User, @Query() query: QueryNotificationsDto) {
    return this.notificationsService.list(user.id, query.page ?? 1, query.pageSize ?? 25);
  }

  // Polled by the bell, so it stays a count and never loads the rows.
  @Get('unread-count')
  async unreadCount(@CurrentUser() user: User) {
    return { count: await this.notificationsService.unreadCount(user.id) };
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: User) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Post(':id/read')
  markRead(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.markRead(user.id, id);
  }
}
