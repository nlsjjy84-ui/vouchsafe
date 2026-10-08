import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { DomainType } from '../common/enums/domain-type.enum';

/**
 * =========================================================================
 * 포트폴리오 스크린샷 / 실제 방문자에게 노출되는 문제 수정용 1회성 스크립트.
 * =========================================================================
 * seed-monthly-history.ts와 seed-anomaly-test.ts가 만든 바운티들은 제목 앞에
 * "[2026-04]" 같은 디버그용 월 표기가 붙어있고, 설명란에 "월별 추이 차트 확인용
 * 시드 데이터입니다." / "소비 이상탐지 기능 확인용 테스트 데이터입니다." 라는
 * 내부 개발용 문구가 그대로 들어가있다. 바운티 목록이 이제 로그인 없이 누구나
 * 볼 수 있게 공개됐기 때문에, 방문자(면접관 포함)가 이 문구를 그대로 보게 된다.
 *
 * 이 스크립트는:
 *   1) 제목 앞의 "[YYYY-MM] " / "[이상탐지 테스트] " 접두어를 제거하고
 *   2) 설명을 도메인별로 자연스러운 실제 의뢰 문구로 교체한다
 * updatedAt/createdAt은 건드리지 않는다 (월별 추이 차트에 영향 없음).
 *
 * 사용법: npx ts-node -r tsconfig-paths/register src/scripts/fix-seed-labels.ts
 * =========================================================================
 */

const DOMAIN_DESC: Record<DomainType, string> = {
  [DomainType.BACKEND_DB_TUNING]: '월말 정산 배치가 실행되는 동안 특정 쿼리에서 응답 지연이 발생하고 있어, 실행 계획 분석과 인덱스 개선을 통한 성능 튜닝이 필요합니다.',
  [DomainType.WEB3_SECURITY_AUDIT]: '스마트 컨트랙트 배포를 앞두고 있어, 재진입 공격 및 권한 관련 취약점 여부를 정밀하게 감사해주실 전문가를 찾습니다.',
  [DomainType.DEV_CODE_REVIEW]: '이번 스프린트에서 병합된 코드에 대해 구조적 문제와 잠재적 버그가 없는지 리뷰해주실 분을 찾습니다.',
  [DomainType.CRAWLING_ARCHITECTURE]: '가격 비교를 위한 수집 파이프라인이 최근 자주 차단되고 있어, 안정성을 높일 수 있는 아키텍처 개선이 필요합니다.',
  [DomainType.MOBILE_QA_AUTOMATION]: '신규 릴리즈 전 회귀 테스트 범위가 넓어져, 자동화 스크립트로 주요 기기·OS 조합을 검증해주실 분을 찾습니다.',
  [DomainType.TECH_CREATOR_CONSULTING]: '채널 성장이 정체되어 있어, 콘텐츠 방향과 업로드 전략에 대한 데이터 기반 자문이 필요합니다.',
  [DomainType.AUDIO_MASTERING_REVIEW]: '발매를 앞둔 신곡의 마스터링 품질을 스트리밍 플랫폼 기준에 맞춰 검수해주실 전문가를 찾습니다.',
  [DomainType.INDIE_GAME_QA]: '업데이트 빌드에 밸런스 이슈가 의심되어, 실제 플레이를 통한 QA와 이슈 리포트를 요청드립니다.',
  [DomainType.GRAPHICS_3D_OPTIMIZATION]: '신규 캐릭터 에셋의 폴리곤 수가 높아 모바일 환경에서 프레임 저하가 우려되어, 최적화 작업이 필요합니다.',
  [DomainType.VEHICLE_DIAGNOSTICS]: '정기 점검 시점이 된 차량에 대해 정밀 진단과 이상 유무 확인을 요청드립니다.',
  [DomainType.BUILDING_DEFECT_INSPECTION]: '입주를 앞둔 세대에서 하자가 의심되어, 전문가의 현장 점검과 소견서를 요청드립니다.',
  [DomainType.FIRE_SAFETY_INSPECTION]: '월간 소방시설 정기 점검 일정에 맞춰, 관련 자격을 갖춘 전문가의 점검을 요청드립니다.',
  [DomainType.STARTUP_CONTRACT_REVIEW]: '신규 투자 계약서 초안에 불리한 조항이 있는지 검토해주실 전문가를 찾습니다.',
  [DomainType.TAX_STRUCTURE_FACTCHECK]: '이번 분기 절세 구조가 실제로 유효한지, 리스크는 없는지 팩트체크를 요청드립니다.',
  [DomainType.REAL_ESTATE_TITLE_ANALYSIS]: '계약을 앞둔 매물의 등기부등본을 바탕으로 권리관계 분석을 요청드립니다.',
};

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  try {
    const dataSource = app.get(DataSource);

    // 1) "[YYYY-MM] " 접두어가 붙은 월별 히스토리 시드
    const monthly = await dataSource.query(
      `SELECT id, title, "domainType" FROM bounties WHERE title ~ '^\\[[0-9]{4}-[0-9]{2}\\] '`,
    );
    for (const row of monthly) {
      const cleanTitle = row.title.replace(/^\[\d{4}-\d{2}\]\s*/, '');
      const desc = DOMAIN_DESC[row.domainType as DomainType] ?? '해당 분야 전문가의 검토를 요청드립니다.';
      await dataSource.query('UPDATE bounties SET title = $1, description = $2 WHERE id = $3', [
        cleanTitle,
        desc,
        row.id,
      ]);
      console.log(`[월별 시드 정리] "${row.title}" -> "${cleanTitle}"`);
    }

    // 2) "[이상탐지 테스트] " 접두어가 붙은 이상탐지 시드
    const anomaly = await dataSource.query(
      `SELECT id, title FROM bounties WHERE title LIKE '[이상탐지 테스트]%'`,
    );
    for (const row of anomaly) {
      const cleanTitle = row.title.replace(/^\[이상탐지 테스트\]\s*/, '');
      const desc = DOMAIN_DESC[DomainType.DEV_CODE_REVIEW];
      await dataSource.query('UPDATE bounties SET title = $1, description = $2 WHERE id = $3', [
        cleanTitle,
        desc,
        row.id,
      ]);
      console.log(`[이상탐지 시드 정리] "${row.title}" -> "${cleanTitle}"`);
    }

    console.log(`\n=== 라벨 정리 완료: 월별 ${monthly.length}건, 이상탐지 ${anomaly.length}건 ===`);
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('시드 라벨 정리 실패:', err);
  process.exit(1);
});
