import { Injectable, Logger } from '@nestjs/common';
import { PaymentGatewayService } from './payment-gateway.interface';

/**
 * 포트원(PortOne) V2 API를 실제로 호출하는 구현체.
 *
 * 사용 방법(연동 정보 화면):
 *  admin.portone.io 로그인 → 결제 연동 > 연동 정보 > 식별코드 · API Keys > V2 API
 *  탭에서 Store ID / API Secret 발급 → .env 의 PORTONE_STORE_ID / PORTONE_API_SECRET에 채움
 *  → PAYMENT_GATEWAY_DRIVER=portone 으로 바꾸면 이 구현체가 실제로 쓰인다.
 *  사업자등록 없이도 "테스트(샌드박스)" 키로 API 호출 자체는 바로 가능하다.
 *
 * 주의(2026-09-14 기준, PROGRESS.md에도 기록):
 *  실제 결제창(체크아웃)을 프론트에서 띄우려면 "채널"(어떤 PG로 결제를 받을지)이
 *  admin.portone.io > 결제 연동 > 채널 관리 에 최소 1개 등록돼 있어야 한다.
 *  채널이 없으면 프론트에서 결제 자체를 시작할 수 없으므로, 이 서비스가 검증/취소를
 *  호출할 paymentId 자체가 아직 생기지 않는다 — 다음 단계로 채널 등록이 필요하다.
 *
 *  또한 이 개발 환경(클라우드 샌드박스)은 보안 정책상 api.portone.io로 나가는
 *  외부 네트워크 요청 자체를 막고 있어서, 여기서는 이 코드를 직접 실행해서 테스트할
 *  수 없다. 실제 서버(배포 환경 또는 개발자의 개인 컴퓨터)에서는 이런 제약이 없으므로
 *  정상 동작한다 - 배포(Render/Railway) 이후 실제로 검증할 예정.
 */
@Injectable()
export class PortOnePaymentGatewayService extends PaymentGatewayService {
  private readonly logger = new Logger(PortOnePaymentGatewayService.name);
  private readonly baseUrl = 'https://api.portone.io';

  private authHeader(): string {
    const secret = process.env.PORTONE_API_SECRET;
    if (!secret) {
      throw new Error(
        'PORTONE_API_SECRET이 설정되지 않았습니다. .env 파일에 포트원 콘솔에서 발급받은 API Secret을 채워주세요.',
      );
    }
    return `PortOne ${secret}`;
  }

  /**
   * GET /payments/{paymentId} - 실제로 결제가 완료됐는지, 금액이 우리가 요청한
   * 금액과 정확히 일치하는지를 PG 서버에 직접 물어본다. 프론트가 보내는 "결제
   * 완료했어요"라는 말을 그대로 믿으면 위변조 가능하므로 반드시 서버 쪽에서
   * 이 확인을 거쳐야 한다 (결제 검증의 핵심 원칙).
   */
  async verifyPayment(paymentId: string, expectedAmount: number): Promise<{ paid: boolean; reason?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/payments/${encodeURIComponent(paymentId)}`, {
        method: 'GET',
        headers: { Authorization: this.authHeader() },
      });

      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`포트원 결제 조회 실패 paymentId=${paymentId} status=${res.status} body=${body}`);
        return { paid: false, reason: `결제 정보를 조회하지 못했습니다 (HTTP ${res.status})` };
      }

      const data = await res.json();
      const isPaid = data?.status === 'PAID';
      const amountMatches = data?.amount?.total === expectedAmount;

      if (!isPaid) {
        return { paid: false, reason: `결제 상태가 완료(PAID)가 아닙니다 (현재: ${data?.status})` };
      }
      if (!amountMatches) {
        return {
          paid: false,
          reason: `결제 금액이 일치하지 않습니다 (요청: ${expectedAmount}, 실제 결제: ${data?.amount?.total})`,
        };
      }
      return { paid: true };
    } catch (err) {
      this.logger.error(`포트원 결제 조회 중 오류: ${(err as Error).message}`);
      return { paid: false, reason: '결제 서버와 통신 중 오류가 발생했습니다' };
    }
  }

  /** POST /payments/{paymentId}/cancel - 환불 발생 시 실제 PG 취소를 요청한다. */
  async cancelPayment(paymentId: string, amount: number, reason: string): Promise<{ cancelled: boolean; reason?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/payments/${encodeURIComponent(paymentId)}/cancel`, {
        method: 'POST',
        headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, amount: { total: amount } }),
      });

      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`포트원 결제 취소 실패 paymentId=${paymentId} status=${res.status} body=${body}`);
        return { cancelled: false, reason: `결제 취소에 실패했습니다 (HTTP ${res.status})` };
      }
      return { cancelled: true };
    } catch (err) {
      this.logger.error(`포트원 결제 취소 중 오류: ${(err as Error).message}`);
      return { cancelled: false, reason: '결제 서버와 통신 중 오류가 발생했습니다' };
    }
  }
}
