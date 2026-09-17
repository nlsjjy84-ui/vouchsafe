import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';
import { BountiesService } from '../modules/bounties/bounties.service';
import { DomainType } from '../common/enums/domain-type.enum';

/**
 * =========================================================================
 * "소비 이상탐지 하이라이트" 기능(AiInsightsService.detectSpendingAnomaly)을
 * 실제로 눈으로 확인하기 위한 1회성 테스트 데이터 스크립트.
 * =========================================================================
 * detectSpendingAnomaly는 "이번 달 도메인별 지출이 직전 3개월 평균보다 30%
 * 이상 급증했는가"를 본다. seed-demo-more.ts는 전부 "오늘" 날짜로만 데이터를
 * 만들기 때문에 비교할 과거 3개월치가 없어서 이상탐지가 절대 안 뜬다.
 *
 * 이 스크립트는 client@demo.com이 DEV_CODE_REVIEW 도메인에서:
 *   - 3개월 전, 2개월 전, 지난달: 각각 100,000원짜리 바운티를 SETTLED 처리
 *   - 이번 달: 500,000원짜리 바운티를 SETTLED 처리 (직전 평균 대비 +400%)
 * 를 만들어서, "이번 달 'IT 개발 및 코드 리뷰' 지출이 급증했어요" 카드가
 * /insights 페이지에 실제로 뜨는지 확인할 수 있게 한다.
 *
 * updatedAt은 @UpdateDateColumn이라 TypeORM을 통한 일반 save로는 과거 날짜를
 * 넣을 수 없어서, DataSource.query()로 raw SQL UPDATE를 날려 직접 덮어쓴다
 * (AiInsightsService의 월별 집계가 updatedAt 기준이라 - 코드 주석 참고).
 *
 * 사용법: npx ts-node -r tsconfig-paths/register src/scripts/seed-anomaly-test.ts
 * =========================================================================
 */

const CLIENT_EMAIL = 'client@demo.com';
const EXPERT_EMAIL = 'expert@demo.com'; // DEV_CODE_REVIEW 도메인 승인된 전문가 (seed-demo.ts)
const DOMAIN = DomainType.DEV_CODE_REVIEW;

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  try {
    const usersService = app.get(UsersService);
    const bountiesService = app.get(BountiesService);
    const dataSource = app.get(DataSource);

    const client = await usersService.findByEmail(CLIENT_EMAIL);
    const expert = await usersService.findByEmail(EXPERT_EMAIL);
    if (!client || !expert) {
      console.log(`${CLIENT_EMAIL} 또는 ${EXPERT_EMAIL} 계정을 찾을 수 없습니다 - 먼저 npm run seed-demo를 실행해주세요.`);
      return;
    }

    const now = new Date();
    // 3개월 전, 2개월 전, 1개월 전(=지난달), 이번 달 - 각 달 15일로 고정해서 월 경계 문제를 피한다.
    const monthsAgo = (n: number) => new Date(now.getFullYear(), now.getMonth() - n, 15, 12, 0, 0);

    const plan: Array<{ title: string; amount: number; date: Date }> = [
      { title: '[이상탐지 테스트] 3개월 전 코드 리뷰', amount: 100000, date: monthsAgo(3) },
      { title: '[이상탐지 테스트] 2개월 전 코드 리뷰', amount: 100000, date: monthsAgo(2) },
      { title: '[이상탐지 테스트] 지난달 코드 리뷰', amount: 100000, date: monthsAgo(1) },
      { title: '[이상탐지 테스트] 이번 달 코드 리뷰 (급증)', amount: 500000, date: now },
    ];

    for (const item of plan) {
      const bounty = await bountiesService.create(client.id, {
        domainType: DOMAIN,
        title: item.title,
        description: '소비 이상탐지 기능 확인용 테스트 데이터입니다.',
        bountyAmount: item.amount,
      });

      const application = await bountiesService.apply(bounty.id, expert.id, {
        message: '테스트 지원입니다.',
      });
      await bountiesService.selectApplicant(bounty.id, application.id, client.id);
      await bountiesService.submitResult(
        bounty.id,
        expert.id,
        '/uploads/mock-result-report.pdf',
        '테스트 결과물입니다.',
      );
      await bountiesService.approve(bounty.id, client.id);

      // SETTLED까지 거치는 동안 updatedAt이 "지금"으로 여러 번 갱신됐으므로,
      // 마지막에 원하는 과거 날짜로 raw SQL로 덮어쓴다.
      // 이 프로젝트는 TypeORM 기본 네이밍 전략을 쓰고 있어서(SnakeNamingStrategy 미설정)
      // DB 컬럼명이 "updated_at"이 아니라 "updatedAt"(camelCase) 그대로다 - 따옴표로 감싸야 한다.
      await dataSource.query('UPDATE bounties SET "updatedAt" = $1 WHERE id = $2', [item.date, bounty.id]);

      console.log(`[SETTLED, updatedAt=${item.date.toISOString().slice(0, 7)}] "${item.title}" (${item.amount.toLocaleString()}원)`);
    }

    console.log('\n=== 이상탐지 테스트 데이터 생성 완료 ===');
    console.log('client@demo.com으로 로그인해서 /insights 페이지를 새로고침하면');
    console.log('"IT 개발 및 코드 리뷰 지출이 급증했어요" 카드가 떠야 합니다.');
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('이상탐지 테스트 데이터 생성 실패:', err);
  process.exit(1);
});
