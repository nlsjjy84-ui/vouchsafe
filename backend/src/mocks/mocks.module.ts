import { Module } from '@nestjs/common';
import { MockVerificationService } from './mock-verification.service';
import { MockEscrowService } from './mock-escrow.service';
import { MockStorageService } from './mock-storage.service';
import { MockMailService } from './mock-mail.service';
import { MockSafeNumberService } from './mock-safe-number.service';
import { MockPaymentGatewayService } from './mock-payment-gateway.service';
import { PortOnePaymentGatewayService } from './portone-payment-gateway.service';
import { PaymentGatewayService } from './payment-gateway.interface';

/**
 * 외부 연동(본인인증/오픈뱅킹/S3/메일/안심번호/PG결제)을 실제 계약 없이도 개발할 수
 * 있게 하는 Mock 어댑터 모음. 나중에 실제 PG/오픈뱅킹/AWS/메일 발송/통신사 계정이
 * 생기면 이 모듈의 provider만 실제 구현체로 교체하면 되고, 이 모듈을 가져다 쓰는
 * 다른 모듈은 코드를 바꿀 필요가 없도록 인터페이스를 고정해뒀다.
 *
 * PaymentGatewayService(2026-09-16 배선): StorageModule의 STORAGE_DRIVER 팩토리와
 * 완전히 같은 패턴 - PAYMENT_GATEWAY_DRIVER 환경변수가 'portone'이면 실제 포트원
 * 구현체, 그 외(기본값)는 항상 결제 성공으로 응답하는 Mock 구현체가 주입된다.
 * 이 인터페이스는 일반 토큰(Symbol) 대신 추상 클래스 자체를 DI 토큰으로 쓴다
 * (payment-gateway.interface.ts 참고 - Nest에서 유효한 패턴).
 */
@Module({
  providers: [
    MockVerificationService,
    MockEscrowService,
    MockStorageService,
    MockMailService,
    MockSafeNumberService,
    MockPaymentGatewayService,
    PortOnePaymentGatewayService,
    {
      provide: PaymentGatewayService,
      useFactory: (mock: MockPaymentGatewayService, portone: PortOnePaymentGatewayService) =>
        process.env.PAYMENT_GATEWAY_DRIVER === 'portone' ? portone : mock,
      inject: [MockPaymentGatewayService, PortOnePaymentGatewayService],
    },
  ],
  exports: [
    MockVerificationService,
    MockEscrowService,
    MockStorageService,
    MockMailService,
    MockSafeNumberService,
    PaymentGatewayService,
  ],
})
export class MocksModule {}
