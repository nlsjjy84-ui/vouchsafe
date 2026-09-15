import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReputationService } from './reputation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly reputationService: ReputationService) {}

  /**
   * 전문가 평판 조회 (완료율 70% + 분쟁 승률 30% 가중평균)
   * GET /api/users/:id/reputation
   * 의뢰인이 지원자 중 누구를 선택할지 판단할 때 참고 자료로 쓴다.
   */
  @Get(':id/reputation')
  getReputation(@Param('id') id: string) {
    return this.reputationService.getExpertReputation(id);
  }
}
