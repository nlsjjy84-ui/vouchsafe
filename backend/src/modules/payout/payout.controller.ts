import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BANKS, PayoutService } from './payout.service';
import { RegisterPayoutDto } from './dto/register-payout.dto';

type AuthUser = { userId: string };

@ApiTags('payout')
@ApiBearerAuth('JWT-auth')
@Controller('payout-account')
@UseGuards(JwtAuthGuard)
export class PayoutController {
  constructor(private readonly payout: PayoutService) {}

  /** 은행 목록 + 내 정산 계좌(가린 번호) — GET /api/payout-account/me */
  @Get('me')
  async mine(@CurrentUser() user: AuthUser) {
    return { banks: BANKS, account: await this.payout.mine(user.userId) };
  }

  /** 정산 계좌 등록·변경(1인 1계좌) — PUT /api/payout-account/me */
  @Put('me')
  async register(@CurrentUser() user: AuthUser, @Body() dto: RegisterPayoutDto) {
    return { account: await this.payout.register(user.userId, dto) };
  }
}
