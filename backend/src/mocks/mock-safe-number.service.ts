import { Injectable, Logger } from '@nestjs/common';

/**
 * 안심전화번호(가상번호) Mock 서비스.
 *
 * 실제 서비스 전환 시 할 일:
 *  - NHN Cloud "070 안심번호" 또는 통신 3사 부가서비스 API로 교체
 *  - generateSafeNumber()는 그 API가 실제로 할당해주는 착신 전환 번호를 그대로 받아 씀
 *  - relayCall()은 실제로는 없음 - 안심번호로 걸려온 전화를 통신사 교환기가
 *    알아서 진짜 번호로 착신 전환해주기 때문. Mock 단계에서는 "연결이 되긴 했다"는
 *    걸 보여주기 위해 로그만 남긴다.
 *
 * 다른 Mock 서비스들(StorageService, PaymentGatewayService)과 달리 인터페이스로
 * 분리하지 않은 이유: 안심번호는 통신사 전용 회선/API 계약이 있어야만 실제로
 * 테스트해볼 수 있는 영역이라, 이 프로젝트 범위(취업용 포트폴리오)에서는 Mock으로
 * 개념 증명만 하고 끝내는 게 맞다고 판단했다 - PROGRESS.md에 이 판단 근거를 기록.
 */
@Injectable()
export class MockSafeNumberService {
  private readonly logger = new Logger(MockSafeNumberService.name);

  /** 050 + 임의 8자리 형식의 가짜 안심번호를 생성한다 */
  generateSafeNumber(): string {
    const mid = Math.floor(1000 + Math.random() * 9000);
    const last = Math.floor(1000 + Math.random() * 9000);
    const safeNumber = `050-${mid}-${last}`;
    this.logger.debug(`[MOCK] 안심번호 발급: ${safeNumber}`);
    return safeNumber;
  }

  /**
   * 안심번호로 "전화를 거는" 흉내를 낸다. 실제로는 통신사 교환기가 처리할 일이라
   * 백엔드가 할 일이 없지만, 프론트엔드 데모/시연에서 "연결되었다"는 걸 보여주고
   * 감사 로그성 기록을 남기기 위한 용도.
   */
  async relayCall(safeNumber: string, callerRole: 'CLIENT' | 'EXPERT'): Promise<{ connected: true; note: string }> {
    this.logger.log(`[MOCK] ${safeNumber} 로 ${callerRole}가 통화 연결 시도 -> 상대방에게 착신 전환됨(모의)`);
    return {
      connected: true,
      note: '[MOCK] 실제 통신사 연동 전이라 실제로 전화가 걸리지는 않습니다. 연동 성공 로그만 남깁니다.',
    };
  }
}
