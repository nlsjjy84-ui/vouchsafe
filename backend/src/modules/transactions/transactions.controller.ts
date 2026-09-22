import { Controller, ForbiddenException, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { Bounty } from '../bounties/entities/bounty.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type AuthUser = { userId: string };

/**
 * =========================================================================
 * TransactionsController — 에스크로 자금 상태 조회
 * =========================================================================
 * 프로젝트의 "진행 단계"(PENDING/LOCKED/SUBMITTED/...)는 BountiesController가 보여주고,
 * "그 프로젝트에 걸린 돈이 지금 어디 있는지"(LOCKED/FROZEN/SETTLED/REFUNDED)는
 * 여기서 보여준다. 프론트엔드 거래 상세 화면에서 상태 배지를 그릴 때 이 API를 쓴다.
 * =========================================================================
 */
@ApiTags('transactions')
@ApiBearerAuth('JWT-auth')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    @InjectRepository(Bounty)
    private readonly bountyRepository: Repository<Bounty>,
  ) {}

  /**
   * 특정 프로젝트의 에스크로 거래 내역 조회. GET /api/transactions/by-bounty/:bountyId
   * (2026-09-22 보안 점검: 로그인만 하면 누구나 다른 프로젝트의 에스크로 금액·수수료·
   * 정산 상태를 볼 수 있었던 접근 제어 누락을 막는다 - 의뢰인 또는 담당 전문가만 조회 가능.)
   */
  @Get('by-bounty/:bountyId')
  async findByBounty(@Param('bountyId') bountyId: string, @CurrentUser() user: AuthUser) {
    const bounty = await this.bountyRepository.findOne({ where: { id: bountyId } });
    if (!bounty) throw new NotFoundException('프로젝트를 찾을 수 없습니다');
    if (user.userId !== bounty.clientId && user.userId !== bounty.assignedExpertId) {
      throw new ForbiddenException('이 프로젝트의 의뢰인 또는 담당 전문가만 조회할 수 있습니다');
    }
    return this.transactionsService.findByBountyId(bountyId);
  }
}
