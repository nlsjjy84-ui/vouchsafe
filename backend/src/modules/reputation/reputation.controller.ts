import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReputationService } from './reputation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * 전문가의 신뢰도 점수를 조회하는 API. 로그인만 하면 누구나 조회할 수 있다
 * (의뢰인이 지원자를 선택하기 전에 "이 전문가 믿을만한가"를 확인하는 용도이므로,
 * 특정 역할로 제한할 이유가 없다 — 마켓플레이스의 공개 신뢰 정보에 가깝다).
 */
@ApiTags('reputation')
@ApiBearerAuth('access-token')
@Controller('experts')
@UseGuards(JwtAuthGuard)
export class ReputationController {
  constructor(private readonly reputationService: ReputationService) {}

  /** GET /api/experts/:expertId/reputation */
  @Get(':expertId/reputation')
  getSummary(@Param('expertId') expertId: string) {
    return this.reputationService.getSummary(expertId);
  }
}
