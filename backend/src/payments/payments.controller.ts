import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PortOneService } from './portone.service';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { BountiesService } from '../modules/bounties/bounties.service';

/**
 * PortOne 결제 2단계(서버 측 검증) 진입점.
 * 프론트엔드가 PortOne SDK로 1단계(클라이언트 결제창)를 마친 뒤, 여기로 paymentId를
 * 보내면 서버가 PortOne에 직접 재조회해서 "진짜 결제됐는지 + 금액이 맞는지"를 확인한다.
 */
@ApiTags('payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(
    private readonly portOneService: PortOneService,
    private readonly bountiesService: BountiesService,
  ) {}

  /** POST /api/payments/portone/confirm — body: { paymentId, bountyId } */
  @Post('portone/confirm')
  async confirm(@Body() dto: ConfirmPaymentDto) {
    const bounty = await this.bountiesService.findOneOrThrow(dto.bountyId);
    const result = await this.portOneService.verifyPayment(dto.paymentId);

    if (!result.paid) {
      throw new BadRequestException('결제가 완료되지 않았습니다');
    }
    if (result.amount !== Number(bounty.bountyAmount)) {
      throw new BadRequestException('결제 금액이 프로젝트 금액과 일치하지 않습니다');
    }

    return { verified: true, paymentId: dto.paymentId, amount: result.amount };
  }
}
