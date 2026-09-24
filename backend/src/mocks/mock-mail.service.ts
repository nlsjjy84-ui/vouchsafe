import { Injectable, Logger } from '@nestjs/common';

/**
 * 메일 발송 서비스.
 * RESEND_API_KEY 환경변수가 설정되어 있으면 Resend API로 실제 메일을 보내고,
 * 없으면(로컬 개발 등) 예전처럼 콘솔에 로그만 남기는 Mock으로 동작한다.
 * 다른 Mock들(MockVerificationService, MockEscrowService)과 동일한 철학 —
 * "인터페이스는 고정, 내부만 나중에 실제 구현체로 교체" — 를 그대로 따른다.
 *
 * 주의: Resend에서 발신 도메인을 아직 인증하지 않았다면(Domains 메뉴),
 * onboarding@resend.dev 발신 주소는 Resend 가입 계정의 이메일로만 실제 수신된다.
 * 다른 사람 이메일로 실제 전달하려면 Resend에서 도메인 인증이 필요하다.
 */
@Injectable()
export class MockMailService {
  private readonly logger = new Logger(MockMailService.name);
  private readonly resendApiKey = process.env.RESEND_API_KEY;
  private readonly fromAddress = process.env.MAIL_FROM ?? 'CredoBounty <onboarding@resend.dev>';

  private get frontendOrigin(): string {
    return (process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000').split(',')[0].trim();
  }

  sendEmailVerification(to: string, rawToken: string): void {
    const link = `${this.frontendOrigin}/verify-email?token=${rawToken}`;
    this.logger.log(
      `[메일 발송] ${to} 에게 이메일 인증 메일 발송 — 토큰: ${rawToken} (링크: ${link})`,
    );
    void this.sendViaResend(
      to,
      '[CredoBounty] 이메일 인증을 완료해주세요',
      `<p>아래 링크를 클릭하면 이메일 인증이 완료됩니다.</p><p><a href="${link}">${link}</a></p>`,
    );
  }

  sendPasswordReset(to: string, rawToken: string): void {
    const link = `${this.frontendOrigin}/reset-password?token=${rawToken}`;
    this.logger.log(
      `[메일 발송] ${to} 에게 비밀번호 재설정 메일 발송 — 토큰: ${rawToken} (링크: ${link})`,
    );
    void this.sendViaResend(
      to,
      '[CredoBounty] 비밀번호 재설정',
      `<p>아래 링크를 클릭하면 비밀번호를 재설정할 수 있습니다.</p><p><a href="${link}">${link}</a></p>`,
    );
  }

  private async sendViaResend(to: string, subject: string, html: string): Promise<void> {
    if (!this.resendApiKey) return; // 키가 없으면 위의 콘솔 로그만 남기고 종료 (Mock 그대로 유지)

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: this.fromAddress, to, subject, html }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`Resend 메일 발송 실패 (${res.status}): ${body}`);
      }
    } catch (err) {
      this.logger.error(`Resend 메일 발송 중 오류: ${(err as Error).message}`);
    }
  }
}
