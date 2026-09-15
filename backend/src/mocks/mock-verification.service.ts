import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';

export type CertificationVerificationStatus = 'APPROVED' | 'REJECTED' | 'PENDING';

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
   * 국세청 사업자상태조회 API, 자격증 진위확인 API, AI OCR 자동 대조를 대체하는 Mock 검증.
   *
   * 3단계로 판정한다:
   *  1) 형식검증 — 증빙번호가 최소 길이를 만족하는지 (기존 로직 그대로)
   *  2) OCR 대조 — 실제로는 제출된 증빙 파일 이미지를 OCR로 읽어 licenseNumber와 대조한다.
   *     Mock 단계에는 진짜 이미지를 읽을 수 없으니, "OCR 신뢰도"를 흉내낸 재현 가능한
   *     시드값으로 대체한다: licenseNumber를 SHA-256으로 해시해서 나온 숫자를 0~99 사이로
   *     매핑한 뒤, 85 미만이면 "OCR 대조 성공"(APPROVED), 85 이상이면 "OCR 신뢰도 낮음/불일치
   *     의심"(PENDING, 관리자 수동검토)으로 판정한다.
   *  같은 licenseNumber는 항상 같은 결과가 나온다(재현 가능) — 실행할 때마다 결과가
   *  달라지면 "이 신청이 왜 반려/보류됐는지" 재현하며 디버깅할 수 없기 때문에 의도적으로
   *  랜덤이 아니라 해시 기반 시드를 쓴다.
   */
  async verifyCertification(licenseNumber: string): Promise<{
    status: CertificationVerificationStatus;
    note: string;
  }> {
    // 실제 API 호출(OCR 서버 왕복)을 흉내내기 위한 인위적 지연
    await new Promise((resolve) => setTimeout(resolve, 300));

    const trimmed = licenseNumber.trim();
    if (trimmed.length < 4) {
      return {
        status: 'REJECTED',
        note: '[MOCK] 1단계 형식검증 실패 - 증빙번호 형식이 너무 짧습니다',
      };
    }

    const ocrConfidenceBucket = this.seededBucket(trimmed);
    if (ocrConfidenceBucket < 85) {
      return {
        status: 'APPROVED',
        note: `[MOCK] 2단계 OCR 대조 통과 (신뢰도 시드 ${ocrConfidenceBucket}/100) - ` +
          '실제 연동 시 공공 API/OCR 서버 대조로 교체 예정',
      };
    }
    return {
      status: 'PENDING',
      note: `[MOCK] 2단계 OCR 신뢰도 낮음 (신뢰도 시드 ${ocrConfidenceBucket}/100) - ` +
        '관리자 수동검토가 필요합니다',
    };
  }

  /** licenseNumber를 SHA-256으로 해시해 0~99 사이의 재현 가능한 정수로 매핑 */
  private seededBucket(input: string): number {
    const hash = createHash('sha256').update(input).digest('hex');
    return parseInt(hash.slice(0, 8), 16) % 100;
  }
}
