import { Injectable, Logger } from '@nestjs/common';
import { PaymentGatewayService } from './payment-gateway.interface';

/**
 * 결제대행사(PG) 없이 개발/테스트를 계속할 수 있게 해주는 Mock 구현체.
 * 실제 PG 서버에 아무것도 묻지 않고 "무조건 결제/취소 성공"으로 응답한다.
 * PAYMENT_GATEWAY_DRIVER 환경변수가 'portone'이 아닐 때 기본으로 이게 쓰인다
 * (mocks.module.ts 참고).
 */
@Injectable()
export class MockPaymentGatewayService extends PaymentGatewayService {
  private readonly logger = new Logger(MockPaymentGatewayService.name);

  async verifyPayment(paymentId: string, expectedAmount: number): Promise<{ paid: boolean }> {
    this.logger.log(`[MOCK] 결제 확인 성공 처리 paymentId=${paymentId} amount=${expectedAmount}`);
    return { paid: true };
  }

  async cancelPayment(paymentId: string, amount: number, reason: string): Promise<{ cancelled: boolean }> {
    this.logger.log(`[MOCK] 결제 취소 성공 처리 paymentId=${paymentId} amount=${amount} 사유=${reason}`);
    return { cancelled: true };
  }
}
