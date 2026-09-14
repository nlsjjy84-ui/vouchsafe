import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook } from '@portone/server-sdk';
import { PaymentWebhookLog } from './entities/payment-webhook-log.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { BountiesService } from '../bounties/bounties.service';
import { EscrowStatus } from '../../common/enums/escrow-status.enum';

/**
 * =========================================================================
 * WebhooksService — 포트원(PortOne)이 우리 서버로 보내오는 결제 웹훅 처리
 * =========================================================================
 * [왜 필요한가]
 * 지금까지 결제 확인은 프론트엔드가 "결제 끝났어요"라고 알려오면 그 순간에
 * 서버가 PG에 재확인(TransactionsService.confirmLock)하는 방식이었다. 이건
 * "사용자가 결제창을 닫지 않고 우리 페이지로 잘 돌아왔을 때"만 동작한다.
 *
 * 웹훅은 그와 별개로, PG가 "그 결제 실제로 어떻게 됐는지"를 우리 서버에
 * 직접(사용자 브라우저를 거치지 않고) 알려주는 통로다. 사용자가 결제 후 창을
 * 닫아버리거나 네트워크가 끊겨도, 웹훅 덕분에 서버는 결제 결과를 놓치지 않는다.
 * 포트원 콘솔의 [결제알림(Webhook) 관리]에 이 엔드포인트 URL을 등록해두면,
 * 결제/취소가 발생할 때마다 포트원이 알아서 호출해준다.
 *
 * [서명 검증이 왜 필수인가]
 * 이 엔드포인트는 로그인 없이(JWT 없이) 열려 있어야 포트원이 호출할 수 있다.
 * 그 말은 곧 "아무나" 이 주소로 가짜 요청을 보낼 수 있다는 뜻이라, 요청이
 * 진짜 포트원에서 온 게 맞는지를 반드시 서명으로 검증해야 한다 — 그렇지 않으면
 * 누구나 "결제 완료됐다"고 서버를 속여 바운티를 무단으로 잠금 해제시킬 수 있다.
 * 포트원은 Standard Webhooks 규격(HMAC 기반)을 쓰고, 공식 SDK(@portone/server-sdk)의
 * Webhook.verify()가 이 검증을 대신 해준다 (직접 HMAC 코드를 짜지 않고 공식
 * SDK를 쓰는 이유: 직접 구현은 타이밍 공격/재전송 공격 등에 취약해지기 쉽다).
 *
 * [이 샌드박스의 한계]
 * 이 개발 환경은 외부에서 우리 서버로 "들어오는" 요청을 받는 것 자체는 막혀있지
 * 않다 (막힌 건 우리가 바깥으로 "나가는" api.portone.io 호출). 그래서 실제
 * 포트원 서버가 보내는 웹훅은 배포 후에나 받아볼 수 있지만, 서명 검증 로직
 * 자체는 우리가 같은 시크릿으로 직접 서명한 테스트 요청을 만들어 로컬에서
 * 완전히 검증할 수 있다 (아래 PROGRESS.md 테스트 기록 참고).
 * =========================================================================
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(PaymentWebhookLog)
    private readonly logRepository: Repository<PaymentWebhookLog>,
    private readonly transactionsService: TransactionsService,
    private readonly bountiesService: BountiesService,
  ) {}

  async handlePortOneWebhook(
    rawBody: Buffer | undefined,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: boolean }> {
    const secret = process.env.PORTONE_WEBHOOK_SECRET;
    if (!secret) {
      this.logger.error('PORTONE_WEBHOOK_SECRET이 설정되지 않아 웹훅을 검증할 수 없습니다. .env를 확인하세요.');
      throw new UnauthorizedException('웹훅 시크릿이 서버에 설정되어 있지 않습니다');
    }
    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('요청 본문이 비어 있습니다');
    }

    const payload = rawBody.toString('utf-8');

    let verified: Webhook.Webhook;
    try {
      verified = await Webhook.verify(secret, payload, headers);
    } catch (err) {
      // 서명이 안 맞거나(위조/시크릿 불일치), 타임스탬프가 너무 오래됐거나(재전송 공격 방지)
      // 필수 헤더가 빠진 경우 - 이유를 자세히 밝히지 않고 401로만 거부한다.
      this.logger.warn(`포트원 웹훅 서명 검증 실패: ${(err as Error).message}`);
      throw new UnauthorizedException('웹훅 서명이 유효하지 않습니다');
    }

    const paymentId = this.extractPaymentId(verified);

    // verified.type은 향후 포트원이 새 이벤트 종류를 추가할 경우를 대비한
    // Unrecognized(symbol) 타입도 포함하는 유니온이라 문자열로 명시 변환한다.
    const eventType = String(verified.type);

    await this.logRepository.save(
      this.logRepository.create({
        provider: 'portone',
        eventType,
        paymentId,
        payload,
      }),
    );

    // 결제가 실제로 승인됐다는 이벤트를 받으면, 혹시 프론트가 confirm 호출을
    // 놓친(창을 닫아버린 등) 거래가 있는지 확인해서 백업으로 확정 처리한다.
    if (verified.type === 'Transaction.Paid' && paymentId) {
      await this.tryAutoConfirmLock(paymentId);
    }

    // 취소/부분취소 이벤트는 우리 쪽 환불 사유(단순변심/전문가귀책/이의제기 중재)에 따라
    // 수수료 계산이 달라지므로, 이 웹훅만으로 자동 환불 처리를 하지는 않는다 - 로그만
    // 남기고, 실제 상태 변경은 기존 플로우(refundClientCancel 등)가 계속 담당한다.
    // (섣불리 자동화했다가 이중 환불 처리되는 게 더 위험하다고 판단 - PROGRESS.md 참고)

    return { received: true };
  }

  private extractPaymentId(webhook: Webhook.Webhook): string | null {
    if (typeof webhook.type === 'string' && webhook.type.startsWith('Transaction.')) {
      const data = (webhook as { data?: { paymentId?: string } }).data;
      return data?.paymentId ?? null;
    }
    return null;
  }

  /**
   * PENDING_PAYMENT 상태인 거래만, 그리고 실패해도 웹훅 응답 자체는 막지 않는다(로그만 남김).
   *
   * 주의: TransactionsService.confirmLock()을 여기서 직접 부르면 안 된다 - 그건
   * Transaction(자금 상태)만 LOCKED로 바꾸고, Bounty(작업 진행 상태)의 status는
   * 그대로 PAYMENT_PENDING에 남아버려서 "돈은 잠겼는데 바운티는 결제 대기로 보이는"
   * 불일치가 생긴다(Task #26에서 바로 이 문제를 막으려고 BountiesService.confirmPayment가
   * 트랜잭션으로 둘을 함께 묶어뒀다). 그래서 반드시 BountiesService.confirmPayment를
   * 통해서 처리한다 - clientId 소유권 검사가 있는 메서드라, 웹훅에는 로그인 사용자가
   * 없으니 바운티에 저장된 실제 clientId를 그대로 넘겨준다(웹훅 자체는 서명으로 이미
   * 신뢰를 확인했으므로 이 시점에는 "PG가 확인해준 사실을 반영"하는 것뿐이다).
   */
  private async tryAutoConfirmLock(paymentId: string): Promise<void> {
    const transaction = await this.transactionsService.findByPaymentId(paymentId);
    if (!transaction) {
      this.logger.warn(`웹훅으로 결제 완료 알림을 받았지만 일치하는 거래가 없습니다 paymentId=${paymentId}`);
      return;
    }
    if (transaction.escrowStatus !== EscrowStatus.PENDING_PAYMENT) {
      // 이미 프론트의 confirm 호출로 처리됐거나(정상), 웹훅이 중복 전송된 경우(재시도 정책) -
      // 둘 다 여기서 조용히 무시하는 게 맞다 (멱등 처리).
      return;
    }
    try {
      const bounty = await this.bountiesService.findOneOrThrow(transaction.bountyId);
      await this.bountiesService.confirmPayment(transaction.bountyId, bounty.clientId);
      this.logger.log(`웹훅으로 결제 lock 자동 확정 완료 bountyId=${transaction.bountyId} paymentId=${paymentId}`);
    } catch (err) {
      this.logger.warn(`웹훅발 자동 lock 확정 실패 bountyId=${transaction.bountyId}: ${(err as Error).message}`);
    }
  }
}
