import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';

/**
 * 기획서 7장 Plan B "본인인증 및 오픈뱅킹 연동이 늦어져도 개발이 멈추지 않도록
 * Mock 본인인증 Controller를 선제 구축한다"의 실제 구현체.
 *
 * 실제 서비스 전환 시 할 일:
 *  - PASS/카카오 본인인증 SDK 콜백에서 받은 CI 값을 그대로 해시해서 저장하도록 교체
 *  - 이 클래스의 인터페이스(generateCi, verifyCertification)는 그대로 유지하고
 *    내부 구현만 실제 API 호출로 바꾸면 나머지 모듈(Auth, Certifications)은 수정 불필요
 *    → 이게 "Mock으로 먼저 개발" 원칙이 의미 있으려면 지켜야 하는 설계 규칙이다.
 */
@Injectable()
export class MockVerificationService {
  private readonly logger = new Logger(MockVerificationService.name);

  /**
   * 실제로는 본인인증 PG가 돌려주는 CI(연계정보) 값.
   * Mock에서는 이메일+임의값을 해시해 "같은 이메일로 재가입해도 같은 사람"처럼 보이게 한다.
   * (완전히 동일한 사람이 이메일을 바꿔 재가입하는 것까지는 Mock 단계에서 막을 수 없음 — 이는
   * 실제 본인인증 연동 후에만 완전히 해결되는 한계로 PROGRESS.md에 기록해둔다.)
   */
  generateCiHash(email: string): string {
    const raw = `${email.toLowerCase()}::${randomUUID()}`;
    const ci = createHash('sha256').update(raw).digest('hex');
    this.logger.debug(`[MOCK] 본인인증 CI 생성: ${email} -> ${ci.slice(0, 12)}...`);
    return ci;
  }

  /**
   * 국세청 사업자상태조회 API, 자격증 진위확인 API 등을 대체하는 Mock 검증.
   * 실제 연동 전까지는 "형식이 그럴듯하면 승인" 정도의 느슨한 규칙으로 동작해서
   * 나머지 흐름(전문가 지원, 바운티 진행)을 계속 개발/테스트할 수 있게 한다.
   */
  async verifyCertification(licenseNumber: string): Promise<{
    approved: boolean;
    note: string;
  }> {
    // 실제 API 호출을 흉내내기 위한 인위적 지연
    await new Promise((resolve) => setTimeout(resolve, 300));

    const looksValid = licenseNumber.trim().length >= 4;
    return {
      approved: looksValid,
      note: looksValid
        ? '[MOCK] 형식 검증 통과 - 실제 연동 시 공공 API/발급기관 대조로 교체 예정'
        : '[MOCK] 증빙번호 형식이 너무 짧습니다',
    };
  }
}
