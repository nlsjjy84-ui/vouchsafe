import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type AuthUser = { userId: string; email: string; role: string };

@ApiTags('dashboard')
@ApiBearerAuth('JWT-auth')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /** [로그인 사용자] 마이페이지 대시보드 한 번에 조회. GET /api/dashboard/me */
  @Get('me')
  getMyDashboard(@CurrentUser() user: AuthUser) {
    return this.dashboardService.getMyDashboard(user.userId);
  }
}
