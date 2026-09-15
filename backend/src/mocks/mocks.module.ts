import { Module } from '@nestjs/common';
import { MockVerificationService } from './mock-verification.service';
import { MockEscrowService } from './mock-escrow.service';
import { MockStorageService } from './mock-storage.service';
import { MockMailService } from './mock-mail.service';
import { MockSafeNumberService } from './mock-safe-number.service';

/**
 * 외부 연동(본인인증/오픈뱅킹/S3/메일/안심번호)을 실제 계약 없이도 개발할 수 있게 하는
 * Mock 어댑터 모음. 나중에 실제 PG/오픈뱅킹/AWS/메일 발송/통신사 계정이 생기면 이 모듈의
 * provider만 실제 구현체로 교체하면 되고, 이 모듈을 가져다 쓰는 다른 모듈은 코드를
 * 바꿀 필요가 없도록 인터페이스를 고정해뒀다.
 */
@Module({
  providers: [
    MockVerificationService,
    MockEscrowService,
    MockStorageService,
    MockMailService,
    MockSafeNumberService,
  ],
  exports: [
    MockVerificationService,
    MockEscrowService,
    MockStorageService,
    MockMailService,
    MockSafeNumberService,
  ],
})
export class MocksModule {}
