import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * =========================================================================
 * TransactionsController — 에스크로 자금 상태 조회
 * =========================================================================
 * 바운티의 "진행 단계"(PENDING/LOCKED/SUBMITTED/...)는 BountiesController가 보여주고,
 * "그 바운티에 걸린 돈이 지금 어디 있는지"(LOCKED/FROZEN/SETTLED/REFUNDED)는
 * 여기서 보여준다. 프론트엔드 거래 상세 화면에서 상태 배지를 그릴 때 이 API를 쓴다.
 * =========================================================================
 */
@ApiTags('transactions')
@ApiBearerAuth('JWT-auth')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /** 특정 바운티의 에스크로 거래 내역 조회. GET /api/transactions/by-bounty/:bountyId */
  @Get('by-bounty/:bountyId')
  findByBounty(@Param('bountyId') bountyId: string) {
    return this.transactionsService.findByBountyId(bountyId);
  }
}
