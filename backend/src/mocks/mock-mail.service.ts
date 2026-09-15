import { Injectable, Logger } from '@nestjs/common';

/**
 * 실제 메일 발송(SES/SendGrid 등) 대신 콘솔에 로그만 남기는 Mock.
 * 다른 Mock들(MockVerificationService, MockEscrowService)과 동일한 철학 —
 * "인터페이스는 고정, 내부만 나중에 실제 구현체로 교체" — 를 그대로 따른다.
 * 개발/테스트 중에는 이 로그에서 인증 링크의 토큰 원문을 그대로 확인할 수 있다.
 */
@Injectable()
export class MockMailService {
  private readonly logger = new Logger(MockMailService.name);

  sendEmailVerification(to: string, rawToken: string): void {
    this.logger.log(
      `[Mock 메일 발송] ${to} 에게 이메일 인증 메일 발송 — 토큰: ${rawToken} ` +
        `(실제로는 POST /api/auth/verify-email/confirm 으로 이 토큰을 보내는 링크를 메일로 전송)`,
    );
  }

  sendPasswordReset(to: string, rawToken: string): void {
    this.logger.log(
      `[Mock 메일 발송] ${to} 에게 비밀번호 재설정 메일 발송 — 토큰: ${rawToken} ` +
        `(실제로는 POST /api/auth/password-reset/confirm 으로 이 토큰을 보내는 링크를 메일로 전송)`,
    );
  }
}
