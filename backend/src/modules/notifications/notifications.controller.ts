import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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

  /** 읽음 처리. POST /api/notifications/:id/read */
  @Post(':id/read')
  async markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.notificationsService.markRead(id, user.userId);
    return { ok: true };
  }
}
