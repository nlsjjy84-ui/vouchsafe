import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type AuthUser = { userId: string };

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** 내 알림 목록 (최신순, 최대 100개). GET /api/notifications/me */
  @Get('me')
  findMine(@CurrentUser() user: AuthUser) {
    return this.notificationsService.findMine(user.userId);
  }

  /** 읽지 않은 알림 개수 - 알림 벨 뱃지에 표시할 숫자. GET /api/notifications/me/unread-count */
  @Get('me/unread-count')
  async unreadCount(@CurrentUser() user: AuthUser) {
    const count = await this.notificationsService.countUnread(user.userId);
    return { count };
  }

  /** 알림 하나 읽음 처리. PATCH /api/notifications/:id/read */
  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notificationsService.markRead(id, user.userId);
  }

  /** 내 알림 전체 읽음 처리. PATCH /api/notifications/read-all */
  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllRead(user.userId);
  }
}
