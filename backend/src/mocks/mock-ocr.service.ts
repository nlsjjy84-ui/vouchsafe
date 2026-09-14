import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * AI OCR 자동 자격증 검증 Mock 서비스.
 *
 * 기획 의도: 지금(MockVerificationService)은 "자격증 번호 글자 수가 4자 이상이면
 * 통과"라는 아주 느슨한 형식 검사만 한다. 실제 서비스에서는 여기에 한 단계를 더
 * 얹는다 - 사용자가 첨부한 증빙 서류(자격증 사진/PDF)를 OCR로 읽어서, 서류에
 * 실제로 적힌 문자열이 입력한 자격증 번호와 일치하는지까지 자동으로 대조한다.
 *
 * 실제 서비스 전환 시 할 일:
 *  - Upstage Document AI, Naver Clova OCR, Google Cloud Vision 등의 실제 OCR API로 교체
 *  - extractAndVerify()의 반환 형태(matched/confidenceScore/extractedTextPreview)는
 *    그대로 유지하고 내부 구현만 실제 API 호출로 바꾸면 나머지 코드(CertificationsService)는
 *    수정할 필요가 없다 - 이 프로젝트 전체에 일관되게 적용한 "Mock으로 먼저 개발" 원칙.
 *
 * Mock 구현 방식: 실제로 이미지를 읽을 수는 없으니, 파일 내용의 해시값을 시드로 써서
 * "OCR이 이 파일을 읽었을 때 대략 이 정도 확률로 성공했을 것"이라는 시나리오를
 * 재현 가능하게(같은 파일 = 항상 같은 결과) 흉내낸다. 실제 OCR도 이미지 화질/각도에
 * 따라 인식률이 달라지므로, "가끔 실패해서 사람이 검토해야 하는 경우"까지 재현하는 게
 * "무조건 성공"보다 더 현실적인 Mock이라고 판단했다.
 */
@Injectable()
export class MockOcrService {
  private readonly logger = new Logger(MockOcrService.name);

  async extractAndVerify(
    fileBuffer: Buffer,
    licenseNumber: string,
  ): Promise<{ matched: boolean; confidenceScore: number; extractedTextPreview: string; note: string }> {
    // 실제 OCR API 호출을 흉내내기 위한 인위적 지연
    await new Promise((resolve) => setTimeout(resolve, 500));

    const hash = createHash('sha256').update(fileBuffer).digest('hex');
    // 해시 앞 4자리를 숫자로 바꿔 0~99 범위로 매핑 -> "인식 성공률 85%" 시나리오 재현
    const seed = parseInt(hash.slice(0, 4), 16) % 100;
    const matched = seed < 85;
    // 신뢰도 점수도 같은 시드에서 파생시켜 매번 같은 파일이면 같은 점수가 나오게 한다
    const confidenceScore = matched ? 80 + (seed % 20) : 30 + (seed % 40);

    const extractedTextPreview = matched
      ? `...자격증번호 ${licenseNumber} 확인됨...`
      : `...문서에서 자격증번호로 추정되는 문자열을 명확히 인식하지 못함 (화질/각도 이슈로 추정)...`;

    const note = matched
      ? `[MOCK OCR] 증빙 서류에서 추출한 문자열이 입력한 자격증 번호와 일치 (인식 신뢰도 ${confidenceScore}%)`
      : `[MOCK OCR] 증빙 서류 자동 대조 실패 (인식 신뢰도 ${confidenceScore}%) - 관리자 수동 검토 필요`;

    this.logger.debug(`[MOCK OCR] 파일 해시 ${hash.slice(0, 12)}... -> matched=${matched}, confidence=${confidenceScore}`);

    return { matched, confidenceScore, extractedTextPreview, note };
  }
}
