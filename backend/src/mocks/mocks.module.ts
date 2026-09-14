import { Module } from '@nestjs/common';
import { MockVerificationService } from './mock-verification.service';
import { MockPaymentGatewayService } from './mock-payment-gateway.service';
import { PortOnePaymentGatewayService } from './portone-payment-gateway.service';
import { PaymentGatewayService } from './payment-gateway.interface';
import { MockStorageService } from './mock-storage.service';
import { S3StorageService } from './s3-storage.service';
import { StorageService } from './storage.interface';
import { MockEmailService } from './mock-email.service';
import { MockSafeNumberService } from './mock-safe-number.service';
import { MockOcrService } from './mock-ocr.service';

/**
 * 외부 연동(본인인증/PG결제/S3/이메일 발송)을 실제 계약 없이도 개발할 수 있게 하는
 * Mock 어댑터 모음. 나중에 실제 PG/오픈뱅킹/메일 발송 계정이 생기면 이 모듈의
 * provider만 실제 구현체로 교체하면 되고, 이 모듈을 가져다 쓰는 다른 모듈(Auth,
 * Certifications, Bounties, Transactions)은 코드를 바꿀 필요가 없도록 인터페이스를
 * 고정해뒀다.
 *
 * StorageService(파일 저장)와 PaymentGatewayService(PG 결제)는 이미 "실제로 전환
 * 가능한" 단계까지 와 있다. 아래 useFactory 안에서 process.env.STORAGE_DRIVER /
 * process.env.PAYMENT_GATEWAY_DRIVER를 읽는데, 반드시 팩토리 "함수 본문 안에서"
 * 읽어야 한다 — @Module 데코레이터의 인자 객체 자체(예: `useClass: process.env.X
 * === 's3' ? A : B` 처럼 밖에서 바로 평가하는 방식)에 넣으면, 이 값이 아직 .env가
 * 로드되기도 전인 "모듈 import 시점"에 평가되어버려서 항상 Mock으로 고정되는 버그가
 * 난다 — auth.module.ts에서 JWT_SECRET 때문에 겪었던 것과 완전히 같은 종류의
 * 버그라 재발 방지 차원에서 처음부터 팩토리 함수로 작성했다.
 */
@Module({
  providers: [
    MockVerificationService,
    MockPaymentGatewayService,
    PortOnePaymentGatewayService,
    MockStorageService,
    S3StorageService,
    MockEmailService,
    MockSafeNumberService,
    MockOcrService,
    {
      provide: StorageService,
      useFactory: (mockStorage: MockStorageService, s3Storage: S3StorageService) => {
        // 기본값은 항상 Mock(로컬 디스크 저장). AWS 자격증명을 .env에 채우고
        // STORAGE_DRIVER=s3로 명시했을 때만 실제 S3로 전환된다.
        return process.env.STORAGE_DRIVER === 's3' ? s3Storage : mockStorage;
      },
      inject: [MockStorageService, S3StorageService],
    },
    {
      provide: PaymentGatewayService,
      useFactory: (mockPg: MockPaymentGatewayService, portOnePg: PortOnePaymentGatewayService) => {
        // 기본값은 항상 Mock(무조건 결제 성공 처리). 포트원 채널(결제수단) 등록과
        // 프론트엔드 체크아웃 연동까지 끝난 뒤 PAYMENT_GATEWAY_DRIVER=portone으로
        // 바꾸면 실제 결제 검증/취소 API를 호출하는 쪽으로 전환된다.
        return process.env.PAYMENT_GATEWAY_DRIVER === 'portone' ? portOnePg : mockPg;
      },
      inject: [MockPaymentGatewayService, PortOnePaymentGatewayService],
    },
  ],
  exports: [
    MockVerificationService,
    PaymentGatewayService,
    StorageService,
    MockEmailService,
    MockSafeNumberService,
    MockOcrService,
  ],
})
export class MocksModule {}
