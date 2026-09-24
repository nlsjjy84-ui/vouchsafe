import { Injectable, Logger } from '@nestjs/common';

/**
 * 기획서 6장 "오픈뱅킹 에스크로 락업"의 Mock 구현.
 * 실제 자금 이동은 없고, "지금 자금이 어떤 상태인지"만 로그로 남긴다.
 *
 * 실제 서비스 전환 시:
 *  - lock(): 오픈뱅킹 출금이체 API 호출 + 플랫폼 안전계좌 입금 확인으로 교체
 *  - settle(): PG 정산 API 호출로 교체
 *  - refund(): PG 취소 API 호출로 교체
 *  인터페이스(메서드 시그니처)는 그대로 두고 내부만 교체하면 되도록 설계했다.
 */
@Injectable()
export class MockEscrowService {
  private readonly logger = new Logger(MockEscrowService.name);

  async lock(amount: number, payerCi: string): Promise<{ reference: string }> {
    const reference = `MOCK-LOCK-${Date.now()}`;
    this.logger.log(`[MOCK] ${amount}원 락업 (지불자 CI: ${payerCi.slice(0, 8)}...) ref=${reference}`);
    return { reference };
  }

  async settle(amount: number, receiverName: string): Promise<{ reference: string }> {
    const reference = `MOCK-SETTLE-${Date.now()}`;
    this.logger.log(`[MOCK] ${amount}원 정산 -> ${receiverName} ref=${reference}`);
    return { reference };
  }

  async refund(amount: number, payerCi: string): Promise<{ reference: string }> {
    const reference = `MOCK-REFUND-${Date.now()}`;
    this.logger.log(`[MOCK] ${amount}원 환불 (지불자 CI: ${payerCi.slice(0, 8)}...) ref=${reference}`);
    return { reference };
  }

  /**
   * 기획서 9장 정산 규칙표 그대로:
   * - 정상 정산: 프로젝트금액 - 플랫폼 기본 수수료(전문가 몫), PG수수료는 플랫폼이 부담
   * - 단순변심 환불: 원금 - PG 결제/취소 수수료(약 3%, 의뢰인 부담)
   * - 전문가 귀책 환불: 전액 환불, PG수수료는 플랫폼 충당금으로 보전
   */
  calculatePlatformFee(amount: number): number {
    const FEE_RATE = 0.1; // 플랫폼 기본 수수료 10% (MVP 가정치 - 실제 요율은 사업 결정 필요)
    return Math.floor(amount * FEE_RATE);
  }

  calculateClientCancelFee(amount: number): number {
    const PG_CANCEL_FEE_RATE = 0.03; // 기획서: PG 결제/취소 수수료 약 3% 내외
    return Math.floor(amount * PG_CANCEL_FEE_RATE);
  }
}
