import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * =========================================================================
 * DashboardController — 마이페이지 통합 대시보드 (Task #31)
 * =========================================================================
 * 예전에는 "내가 등록한 바운티"를 보려면 전체 바운티 목록에서 직접 찾아야
 * 했고, "내가 지원한 바운티"는 아예 볼 방법이 없었다(지원 당한 쪽인
 * 의뢰인만 GET /bounties/:id/applicants로 볼 수 있었음). 자격 인증 현황도
 * /certifications 화면에 따로, 안 읽은 알림 수도 네비게이션 바 종에 따로
 * 흩어져 있었다.
 *
 * 이 엔드포인트 하나가 그 전부를 한 번에 모아서 돌려준다 - "마이페이지에
 * 들어오면 내 활동이 한눈에 보인다"는 목적 그대로. 실제 조립 로직은
 * DashboardService(및 각 도메인 서비스)에 있고, 여기서는 인증된 사용자의
 * id를 꺼내 넘기기만 한다.
 * =========================================================================
 */
@ApiTags('dashboard')
@ApiBearerAuth('access-token')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /** GET /api/dashboard/me */
  @Get('me')
  getMyDashboard(@CurrentUser() user: { userId: string }) {
    return this.dashboardService.getMyDashboard(user.userId);
  }
}
