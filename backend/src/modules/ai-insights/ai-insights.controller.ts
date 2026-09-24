import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AiInsightsService } from './ai-insights.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type AuthUser = { userId: string };

/**
 * =========================================================================
 * AiInsightsController — "AI 기반 개인화 예산/소비패턴 분석" 및
 * "AI & 마이데이터 기반 개인화 금융관리" 기능의 진입점.
 * =========================================================================
 * 지금 단계에서는 내 활동 이력(프로젝트/거래/자격) 전체를 마이데이터처럼 취급해
 * 분석한다. GET /api/ai-insights/me 하나로 요약 통계 + 분야별 분포 + 6개월 추이 +
 * 자연어 인사이트 문장까지 한 번에 내려준다 (프론트 대시보드/인사이트 페이지에서 단일 호출로 사용).
 */
@ApiTags('ai-insights')
@ApiBearerAuth('JWT-auth')
@Controller('ai-insights')
@UseGuards(JwtAuthGuard)
export class AiInsightsController {
  constructor(private readonly aiInsightsService: AiInsightsService) {}

  @Get('me')
  getMine(@CurrentUser() user: AuthUser) {
    return this.aiInsightsService.getMyInsights(user.userId);
  }
}
