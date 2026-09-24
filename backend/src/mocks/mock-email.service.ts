import { Injectable, Logger } from '@nestjs/common';

/**
 * 실제 메일 발송(AWS SES, SendGrid 등) 없이도 "비밀번호 재설정"과 "이메일 인증"
 * 흐름 전체를 개발/테스트할 수 있게 해주는 Mock 어댑터.
 *
 * 지금은 실제로 메일을 보내지 않고 콘솔에 로그로 남긴다. 로컬/개발 환경에서는
 * 이 로그에 찍힌 링크를 그대로 복사해서 테스트하면 된다.
 *
 * 실제 서비스 전환 시 할 일: 이 클래스 내부만 Nodemailer + AWS SES(또는 SendGrid
 * 등)로 교체하면 된다. 메서드 시그니처(sendPasswordResetEmail, sendVerificationEmail)는
 * 그대로 유지되므로 이 서비스를 호출하는 AuthService 쪽은 코드를 바꿀 필요가 없다 —
 * 다른 Mock 어댑터(MockVerificationService 등)와 동일한 설계 원칙.
 */
@Injectable()
export class MockEmailService {
  private readonly logger = new Logger(MockEmailService.name);

  sendPasswordResetEmail(email: string, resetLink: string): void {
    this.logger.log(
      `[MOCK EMAIL] 비밀번호 재설정 메일 -> ${email}\n` +
        `  제목: [Vouchsafe] 비밀번호 재설정 안내\n` +
        `  링크(30분간 유효): ${resetLink}`,
    );
  }

  sendVerificationEmail(email: string, verifyLink: string): void {
    this.logger.log(
      `[MOCK EMAIL] 이메일 인증 메일 -> ${email}\n` +
        `  제목: [Vouchsafe] 이메일 인증 안내\n` +
        `  링크(24시간 유효): ${verifyLink}`,
    );
  }
}
