import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * 안심전화번호(050 가상번호) 연동 Mock.
 * 실제로는 통신사 안심번호 API(예: 원폰/타워)를 호출해 070/050 가상번호를 발급받아
 * 실제 번호와 매핑해두고, 그 가상번호로 걸려온 전화를 실제 번호로 중계한다.
 * 동행(COMPANION) 서비스에서 의뢰인과 전문가가 실제 전화번호를 교환하지 않고도
 * 약속을 조율할 수 있게 하기 위한 장치 — 기획서 7장 "개인정보 최소 노출 원칙"의 연장선.
 *
 * Mock에서는 실제 가상 회선을 발급하지 않고, 입력값을 SHA-256으로 해시해 재현 가능한
 * "050-XXXX-XXXX" 형태의 문자열만 만들어낸다 (실 회선 없이도 매핑 로직/API 형태를 검증 가능).
 */
@Injectable()
export class MockSafeNumberService {
  private readonly logger = new Logger(MockSafeNumberService.name);

  generateSafeNumber(seed: string): string {
    const hash = createHash('sha256').update(seed).digest('hex');
    const middle = parseInt(hash.slice(0, 4), 16) % 10000;
    const last = parseInt(hash.slice(4, 8), 16) % 10000;
    const safeNumber = `050-${String(middle).padStart(4, '0')}-${String(last).padStart(4, '0')}`;
    this.logger.debug(`[MOCK] 안심번호 발급: seed=${seed.slice(0, 8)}... -> ${safeNumber}`);
    return safeNumber;
  }
}
