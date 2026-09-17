import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type AuthUser = { userId: string };

@ApiTags('notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** 내 알림 최근 20건. GET /api/notifications/me */
  @Get('me')
  findMine(@CurrentUser() user: AuthUser) {
    return this.notificationsService.findMine(user.userId);
  }

  /**
   * 안 읽은 알림 개수. GET /api/notifications/me/unread-count
   * NotificationBell.tsx가 30초마다 폴링하는 엔드포인트인데, 서비스 레이어
   * (countUnread)만 있고 컨트롤러에 라우트가 빠져 있어서 계속 404였다 - 실제
   * 버그(발견 경위: 콘솔 네트워크 로그에서 반복되는 404를 보고 역추적).
   */
  @Get('me/unread-count')
  async countUnread(@CurrentUser() user: AuthUser) {
    const count = await this.notificationsService.countUnread(user.userId);
    return { count };
  }

  /**
   * 읽음 처리. PATCH /api/notifications/:id/read
   * 프론트(NotificationBell.tsx)는 patch로 호출하는데 여기가 POST로 돼 있어서
   * 메서드 불일치로 항상 실패하고 있었다 - PATCH로 맞춘다.
   */
  @Patch(':id/read')
  async markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.notificationsService.markRead(id, user.userId);
    return { ok: true };
  }

  /** "모두 읽음 처리". PATCH /api/notifications/read-all (이것도 컨트롤러에 아예 없었다) */
  @Patch('read-all')
  async markAllRead(@CurrentUser() user: AuthUser) {
    await this.notificationsService.markAllRead(user.userId);
    return { ok: true };
  }
}
