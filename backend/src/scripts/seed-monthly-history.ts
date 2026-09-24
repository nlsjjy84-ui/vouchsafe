import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';
import { BountiesService } from '../modules/bounties/bounties.service';
import { DomainType } from '../common/enums/domain-type.enum';

/**
 * =========================================================================
 * /insights 페이지의 "최근 6개월 지출/수익 추이" 차트(AiInsightsService.buildMonthlyTrend)를
 * 실제로 확인/시연하기 위한 1회성 데이터 스크립트.
 * =========================================================================
 * buildMonthlyTrend는 SETTLED된 프로젝트의 updatedAt을 기준으로 월을 나눈다.
 * seed-demo.ts / seed-demo-more.ts는 전부 "오늘" 날짜로만 데이터를 만들기 때문에
 * 6개월치 추이 그래프가 이번 달 막대 하나만 있고 나머지는 0으로 텅 비어 보인다.
 *
 * 이 스크립트는 이번 달을 포함한 최근 6개월에 걸쳐 총 30건(달마다 5건)의 프로젝트를
 * 만들고 전부 SETTLED까지 진행한 뒤, updatedAt을 각 달 15일로 raw SQL로 되돌려서
 * 차트에 실제 굴곡이 생기게 한다 (seed-anomaly-test.ts와 같은 방식).
 *
 * 먼저 seed-demo.ts와 seed-demo-more.ts가 실행되어 있어야 한다 (client/expert 계정을
 * 그대로 재사용한다 - 새 계정을 만들지 않는다).
 *
 * 사용법: npx ts-node -r tsconfig-paths/register src/scripts/seed-monthly-history.ts
 * =========================================================================
 */

// 도메인마다 "이 도메인 지원 자격을 가진 전문가" 1명 (seed-demo-more.ts와 동일한 매핑)
const DOMAIN_EXPERT_EMAIL: Record<DomainType, string> = {
  [DomainType.BACKEND_DB_TUNING]: 'expert2@demo.com',
  [DomainType.WEB3_SECURITY_AUDIT]: 'expert5@demo.com',
  [DomainType.DEV_CODE_REVIEW]: 'expert@demo.com',
  [DomainType.CRAWLING_ARCHITECTURE]: 'expert6@demo.com',
  [DomainType.MOBILE_QA_AUTOMATION]: 'expert7@demo.com',
  [DomainType.TECH_CREATOR_CONSULTING]: 'expert8@demo.com',
  [DomainType.AUDIO_MASTERING_REVIEW]: 'expert9@demo.com',
  [DomainType.INDIE_GAME_QA]: 'expert10@demo.com',
  [DomainType.GRAPHICS_3D_OPTIMIZATION]: 'expert11@demo.com',
  [DomainType.VEHICLE_DIAGNOSTICS]: 'expert12@demo.com',
  [DomainType.BUILDING_DEFECT_INSPECTION]: 'expert3@demo.com',
  [DomainType.FIRE_SAFETY_INSPECTION]: 'expert13@demo.com',
  [DomainType.STARTUP_CONTRACT_REVIEW]: 'expert4@demo.com',
  [DomainType.TAX_STRUCTURE_FACTCHECK]: 'expert14@demo.com',
  [DomainType.REAL_ESTATE_TITLE_ANALYSIS]: 'expert15@demo.com',
};

const DOMAIN_TITLE: Record<DomainType, string> = {
  [DomainType.BACKEND_DB_TUNING]: '월간 정산 배치 쿼리 성능 점검',
  [DomainType.WEB3_SECURITY_AUDIT]: '토큰 이코노미 컨트랙트 정기 감사',
  [DomainType.DEV_CODE_REVIEW]: '월간 스프린트 코드 리뷰',
  [DomainType.CRAWLING_ARCHITECTURE]: '가격 수집 크롤러 안정성 점검',
  [DomainType.MOBILE_QA_AUTOMATION]: '앱 정기 릴리즈 회귀 테스트',
  [DomainType.TECH_CREATOR_CONSULTING]: '채널 성장 전략 월간 자문',
  [DomainType.AUDIO_MASTERING_REVIEW]: '신곡 마스터링 품질 검수',
  [DomainType.INDIE_GAME_QA]: '업데이트 빌드 밸런스 QA',
  [DomainType.GRAPHICS_3D_OPTIMIZATION]: '신규 캐릭터 에셋 최적화',
  [DomainType.VEHICLE_DIAGNOSTICS]: '정기 점검 차량 정밀 진단',
  [DomainType.BUILDING_DEFECT_INSPECTION]: '입주 예정 세대 하자 점검',
  [DomainType.FIRE_SAFETY_INSPECTION]: '월간 소방시설 정기 점검',
  [DomainType.STARTUP_CONTRACT_REVIEW]: '신규 계약서 초안 검토',
  [DomainType.TAX_STRUCTURE_FACTCHECK]: '분기 절세 구조 팩트체크',
  [DomainType.REAL_ESTATE_TITLE_ANALYSIS]: '매물 등기부 권리분석',
};

const ALL_CLIENT_EMAILS = [
  'client@demo.com', 'client2@demo.com', 'client3@demo.com', 'client4@demo.com', 'client5@demo.com',
  'client6@demo.com', 'client7@demo.com', 'client8@demo.com', 'client9@demo.com', 'client10@demo.com',
  'client11@demo.com', 'client12@demo.com', 'client13@demo.com', 'client14@demo.com', 'client15@demo.com',
];

const DOMAINS = Object.keys(DOMAIN_EXPERT_EMAIL) as DomainType[];
const MONTHS_BACK = 6; // 이번 달 포함 최근 6개월
const PER_MONTH = 5; // 달마다 5건 = 총 30건

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  try {
    const usersService = app.get(UsersService);
    const bountiesService = app.get(BountiesService);
    const dataSource = app.get(DataSource);

    // seed-demo-more.ts가 먼저 실행됐는지 확인 (client15@demo.com 존재 여부로 판단)
    const checkUser = await usersService.findByEmail('client15@demo.com');
    if (!checkUser) {
      console.log('client15@demo.com 계정이 없습니다 - 먼저 npm run seed-demo와 npm run seed-demo-more를 실행해주세요.');
      return;
    }

    const clients: Record<string, { id: string }> = {};
    for (const email of ALL_CLIENT_EMAILS) {
      const u = await usersService.findByEmail(email);
      if (!u) {
        console.log(`경고: ${email} 계정을 찾을 수 없습니다.`);
        return;
      }
      clients[email] = u;
    }
    const experts: Record<string, { id: string }> = {};
    for (const email of new Set(Object.values(DOMAIN_EXPERT_EMAIL))) {
      const u = await usersService.findByEmail(email);
      if (!u) {
        console.log(`경고: ${email} 계정을 찾을 수 없습니다.`);
        return;
      }
      experts[email] = u;
    }

    const now = new Date();
    let clientCursor = 0;
    let created = 0;

    // monthOffset: 0 = 이번 달, 5 = 5개월 전. 오래된 달일수록 살짝 낮은 금액대로 시작해서
    // 최근 달로 올수록 늘어나는 "성장하는 것처럼 보이는" 추이를 만든다.
    for (let monthOffset = MONTHS_BACK - 1; monthOffset >= 0; monthOffset--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - monthOffset, 15, 12, 0, 0);
      const monthKey = monthDate.toISOString().slice(0, 7);
      const growthFactor = 1 + (MONTHS_BACK - 1 - monthOffset) * 0.15; // 과거일수록 작게, 최근일수록 크게

      for (let j = 0; j < PER_MONTH; j++) {
        const domain = DOMAINS[(created + j) % DOMAINS.length];
        const expertEmail = DOMAIN_EXPERT_EMAIL[domain];
        const expert = experts[expertEmail];
        const client = clients[ALL_CLIENT_EMAILS[clientCursor % ALL_CLIENT_EMAILS.length]];
        clientCursor++;

        const baseAmount = 150000 + ((created + j) % 5) * 40000;
        const amount = Math.round((baseAmount * growthFactor) / 10000) * 10000;

        const bounty = await bountiesService.create(client.id, {
          domainType: domain,
          title: `[${monthKey}] ${DOMAIN_TITLE[domain]}`,
          description: '월별 추이 차트 확인용 시드 데이터입니다.',
          bountyAmount: amount,
        });
        const application = await bountiesService.apply(bounty.id, expert.id, {
          message: '해당 분야 경험이 있습니다. 진행하겠습니다.',
        });
        await bountiesService.selectApplicant(bounty.id, application.id, client.id);
        await bountiesService.confirmPayment(bounty.id, client.id);
        await bountiesService.submitResult(
          bounty.id,
          expert.id,
          '/uploads/mock-result-report.pdf',
          '요청하신 작업을 완료했습니다.',
        );
        await bountiesService.approve(bounty.id, client.id);

        // SETTLED까지 진행하는 동안 updatedAt이 "지금"으로 여러 번 갱신됐으므로
        // 마지막에 원하는 과거 날짜로 raw SQL로 덮어쓴다 (컬럼명은 camelCase 그대로라 따옴표 필요).
        await dataSource.query('UPDATE bounties SET "updatedAt" = $1, "createdAt" = $1 WHERE id = $2', [
          monthDate,
          bounty.id,
        ]);

        console.log(`[${monthKey}] "${bounty.title}" - ${amount.toLocaleString()}원 (SETTLED)`);
        created++;
      }
    }

    console.log(`\n=== 월별 히스토리 시드 완료: 총 ${created}건 (최근 ${MONTHS_BACK}개월 x ${PER_MONTH}건) ===`);
    console.log('아무 client 계정으로 로그인해서 /insights 페이지를 보면 6개월 추이 그래프에 굴곡이 보일 거예요.');
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('월별 히스토리 시드 실패:', err);
  process.exit(1);
});
