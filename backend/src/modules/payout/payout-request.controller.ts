import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PayoutRequestService } from './payout-request.service';
import { CreatePayoutRequestDto, RejectPayoutRequestDto } from './dto/payout-request.dto';

type AuthUser = { userId: string };

@ApiTags('payout')
@ApiBearerAuth('JWT-auth')
@Controller('payout-requests')
@UseGuards(JwtAuthGuard)
export class PayoutRequestController {
  constructor(private readonly service: PayoutRequestService) {}

  /** 출금 가능 금액 + 내 출금 신청 내역 — GET /api/payout-requests/me */
  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.service.mine(user.userId);
  }

  /** 출금 신청(금액을 비우면 가능한 금액 전부) — POST /api/payout-requests */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePayoutRequestDto) {
    return this.service.request(user.userId, dto.amount);
  }

  /** [관리자] 처리 대기 출금 신청 */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('pending')
  pending() {
    return this.service.pending();
  }

  /** [관리자] 승인 → 모의 송금 */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user.userId);
  }

  /** [관리자] 반려(사유 필수) — 금액은 다시 출금 가능 잔액으로 */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/reject')
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Body() dto: RejectPayoutRequestDto) {
    return this.service.reject(id, user.userId, dto.reason);
  }
}
