import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReputationService } from './reputation.service';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateBudgetDto } from './dto/update-budget.dto';

type AuthUser = { userId: string };

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly reputationService: ReputationService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * 전문가 평판 조회 (완료율 70% + 분쟁 승률 30% 가중평균)
   * GET /api/users/:id/reputation
   * 의뢰인이 지원자 중 누구를 선택할지 판단할 때 참고 자료로 쓴다.
   */
  @Get(':id/reputation')
  getReputation(@Param('id') id: string) {
    return this.reputationService.getExpertReputation(id);
  }

  /**
   * "AI 기반 개인화 예산 및 소비패턴 분석" 기능용 - 내 월 지출 예산 목표 설정/해제.
   * PATCH /api/users/me/budget
   */
  @Patch('me/budget')
  async updateBudget(@CurrentUser() user: AuthUser, @Body() dto: UpdateBudgetDto) {
    await this.usersService.updateMonthlyBudgetGoal(user.userId, dto.monthlyBudgetGoal ?? null);
    return { monthlyBudgetGoal: dto.monthlyBudgetGoal ?? null };
  }
}
