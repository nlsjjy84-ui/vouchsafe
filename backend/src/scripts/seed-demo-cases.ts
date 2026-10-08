import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';
import { BountiesService } from '../modules/bounties/bounties.service';
import { DisputesService } from '../modules/disputes/disputes.service';
import { DomainType } from '../common/enums/domain-type.enum';
import { ServiceType } from '../common/enums/service-type.enum';

/**
 * 거래 사례 시연용 데이터: "성공만 있는" 사례 목록이 아니라 여러 결과가 섞여 있는 목록을 만든다.
 *   SUCCESS              : 이의 없이 정산 (빠름/느림, 의뢰인 평가 높음/낮음/없음)
 *   SUCCESS_AFTER_DISPUTE: 분쟁이 있었지만 중재 결과 전문가 정산 유지
 *   REFUNDED             : 중재 결과 의뢰인 전액 환불 (전문가 귀책 실패)
 *   ON_HOLD              : 분쟁 진행 중이라 자금이 동결된 보류
 * 시스템 점수는 ReputationService가 실제 이력(완료·환불·분쟁·소요시간)으로 계산하고,
 * 의뢰인 점수는 의뢰인이 따로 남긴 값이라 서로 다르게 나온다.
 * 사용법: npm run seed-demo-cases   (seed-demo, seed-demo-match 이후. 로컬 시연 전용, 여러 번 실행해도 중복 생성 안 함)
 */
type Outcome = 'SUCCESS' | 'DISPUTE_SETTLE' | 'REFUND' | 'HOLD';
interface Scenario {
  expert: string;
  client: string;
  domain: DomainType;
  title: string;
  description: string;
  amount: number;
  outcome: Outcome;
  daysAgo: number; // 마지막 상태가 된 시점(오늘 기준 며칠 전)
  takenDays: number; // 의뢰 등록 → 종결까지 걸린 일수
  rating?: number; // 의뢰인 평가 (SUCCESS / DISPUTE_SETTLE 에서만)
  note?: string;
  disputeReason?: string;
  adminNote?: string;
  companion?: string;
}

const SCENARIOS: Scenario[] = [
  // ── 중고차 ──
  { expert: 'match-car1@demo.com', client: 'client@demo.com', domain: DomainType.VEHICLE_DIAGNOSTICS,
    title: '[사례] 중고 SUV 구매 전 현장 동행 점검 (성수)', description: '구매 예정 SUV의 사고 이력·침수 여부·하부 부식을 현장에서 함께 확인했습니다.',
    amount: 160000, outcome: 'SUCCESS', daysAgo: 3, takenDays: 1, rating: 9.5, note: '현장에서 바로 설명해 주셔서 계약 여부를 결정하기 쉬웠어요.',
    companion: '서울 성동구 중고차 매매단지' },
  { expert: 'match-car2@demo.com', client: 'client2@demo.com', domain: DomainType.VEHICLE_DIAGNOSTICS,
    title: '[사례] 중고 전기차 배터리 상태 진단', description: '배터리 SOH와 충전 이력 자료를 분석해 잔존 수명 보고서를 작성했습니다.',
    amount: 150000, outcome: 'SUCCESS', daysAgo: 9, takenDays: 8, rating: 6.0, note: '내용은 정확했지만 약속한 날짜보다 며칠 늦게 받았습니다.' },
  { expert: 'match-car2@demo.com', client: 'client3@demo.com', domain: DomainType.VEHICLE_DIAGNOSTICS,
    title: '[사례] 중고 화물차 주행거리 조작 여부 확인', description: '정비 이력과 계기판 주행거리를 대조해 조작 여부를 확인했습니다.',
    amount: 120000, outcome: 'HOLD', daysAgo: 6, takenDays: 6,
    disputeReason: '보고서에 조작 여부 판단 근거가 빠져 있어 보완 요청 중입니다. 근거 자료 없이는 승인하기 어렵습니다.' },
  { expert: 'match-car1@demo.com', client: 'client2@demo.com', domain: DomainType.VEHICLE_DIAGNOSTICS,
    title: '[사례] 수입 중고차 계약 전 동행검증', description: '성능기록부와 실차 상태를 대조해 불일치 항목을 보고했습니다.',
    amount: 210000, outcome: 'SUCCESS', daysAgo: 1, takenDays: 2, companion: '경기 하남시 수입차 전시장' },
  // ── 부동산 ──
  { expert: 'match-re1@demo.com', client: 'client@demo.com', domain: DomainType.REAL_ESTATE_TITLE_ANALYSIS,
    title: '[사례] 빌라 전세 계약 전 근저당·보증금 위험 분석', description: '등기부 근저당과 선순위 보증금을 분석해 계약 위험도를 정리했습니다.',
    amount: 230000, outcome: 'SUCCESS', daysAgo: 5, takenDays: 2, rating: 10 , note: '위험 요소를 표로 정리해 주셔서 집주인과 협상할 때 큰 도움이 됐습니다.' },
  { expert: 'match-re2@demo.com', client: 'client3@demo.com', domain: DomainType.REAL_ESTATE_TITLE_ANALYSIS,
    title: '[사례] 오피스텔 전세사기 위험 등기부 점검', description: '등기부와 건축물대장을 대조해 위험 신호를 점검했습니다.',
    amount: 190000, outcome: 'DISPUTE_SETTLE', daysAgo: 12, takenDays: 7, rating: 5.5,
    note: '처음 결과물은 아쉬웠지만 중재 후 확인해 보니 요청 범위는 충족했습니다.',
    disputeReason: '요청한 건축물대장 대조 결과가 보고서에 보이지 않는다고 판단해 이의를 제기합니다.',
    adminNote: '제출 파일 3쪽에 건축물대장 대조표가 포함되어 있음을 확인. 전문가 정산 유지.' },
  { expert: 'match-re2@demo.com', client: 'client@demo.com', domain: DomainType.REAL_ESTATE_TITLE_ANALYSIS,
    title: '[사례] 상가 임차 전 권리분석 (보고서 검수 중)', description: '임차 예정 상가의 소유권과 권리 제한 사항을 분석했습니다.',
    amount: 200000, outcome: 'HOLD', daysAgo: 2, takenDays: 2,
    disputeReason: '근저당 말소 예정이라는 설명의 근거 서류가 첨부되지 않아 확인이 필요합니다.' },
  { expert: 'match-re3@demo.com', client: 'client2@demo.com', domain: DomainType.REAL_ESTATE_TITLE_ANALYSIS,
    title: '[사례] 경매 아파트 임장 대행 (현장 미방문)', description: '경매 예정 아파트의 현장 상태와 점유 현황을 확인하는 임장 대행입니다.',
    amount: 280000, outcome: 'REFUND', daysAgo: 8, takenDays: 5,
    disputeReason: '보고서의 현장 사진이 로드뷰 캡처로 보이며 실제 방문 흔적과 점유자 확인 내용이 없습니다.',
    adminNote: '현장 사진 메타데이터와 방문 일시를 확인할 수 없어 임장 미이행으로 판단. 의뢰인 전액 환불.', companion: '경기 성남시 분당구 해당 단지 정문' },
  { expert: 'match-re1@demo.com', client: 'client3@demo.com', domain: DomainType.REAL_ESTATE_TITLE_ANALYSIS,
    title: '[사례] 토지 임장 및 경계 확인', description: '토지 경계와 도로 접합 상태를 현장에서 확인했습니다.',
    amount: 220000, outcome: 'SUCCESS', daysAgo: 20, takenDays: 4, rating: 8.0, companion: '충남 천안시 해당 토지 입구' },
  // ── 개발·DB ──
  { expert: 'match-dev2@demo.com', client: 'client@demo.com', domain: DomainType.DEV_CODE_REVIEW,
    title: '[사례] 결제 API 보안 코드 리뷰 (범위 미달)', description: '결제 API의 인증·권한·입력 검증을 점검하는 코드 리뷰입니다.',
    amount: 300000, outcome: 'REFUND', daysAgo: 15, takenDays: 6,
    disputeReason: '요청한 인증·권한 검증 항목은 빠지고 코드 스타일 지적만 제출되었습니다.',
    adminNote: '요청 범위 3개 항목 중 2개가 누락된 것으로 확인. 의뢰인 전액 환불.' },
  { expert: 'match-dev1@demo.com', client: 'client2@demo.com', domain: DomainType.DEV_CODE_REVIEW,
    title: '[사례] 주문 서비스 트랜잭션 경계 리뷰', description: '서비스 계층의 트랜잭션 경계와 예외 처리 방식을 리뷰했습니다.',
    amount: 260000, outcome: 'SUCCESS', daysAgo: 7, takenDays: 3, rating: 3.0, note: '지적은 맞았지만 개선 코드 예시가 거의 없어 기대보다 얕았습니다.' },
  { expert: 'match-db1@demo.com', client: 'client3@demo.com', domain: DomainType.BACKEND_DB_TUNING,
    title: '[사례] 매출 집계 쿼리 인덱스 튜닝', description: '슬로우 쿼리 실행계획을 분석해 복합 인덱스를 설계하고 전후 응답시간을 비교했습니다.',
    amount: 310000, outcome: 'SUCCESS', daysAgo: 4, takenDays: 2, rating: 9.0, note: '응답시간이 4초에서 0.3초로 줄었습니다.' },
  { expert: 'match-db2@demo.com', client: 'client@demo.com', domain: DomainType.BACKEND_DB_TUNING,
    title: '[사례] 조회 API 캐시 계층 도입', description: 'Redis 캐시 도입 위치와 무효화 전략을 정리했습니다.',
    amount: 280000, outcome: 'SUCCESS', daysAgo: 10, takenDays: 11 }, // 평가 없음
];

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    console.error('운영 환경에서는 실행할 수 없습니다.');
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const users = app.get(UsersService);
    const bounties = app.get(BountiesService);
    const disputes = app.get(DisputesService, { strict: false });
    const ds = app.get(DataSource);

    let made = 0;
    for (const s of SCENARIOS) {
      const exists = await ds.query(`SELECT 1 FROM bounties WHERE title = $1 LIMIT 1`, [s.title]);
      if (exists.length) { console.log(`건너뜀(이미 있음): ${s.title}`); continue; }
      const expert = await users.findByEmail(s.expert);
      const client = await users.findByEmail(s.client);
      if (!expert || !client) {
        console.log(`건너뜀(계정 없음 - seed-demo / seed-demo-match 먼저): ${s.title}`);
        continue;
      }
      try {
        const b = await bounties.create(client.id, {
          domainType: s.domain, title: s.title, description: s.description, bountyAmount: s.amount,
          ...(s.companion
            ? { serviceType: ServiceType.COMPANION, companionLocation: s.companion,
                companionMeetingAt: new Date(Date.now() + 86_400_000).toISOString() }
            : {}),
        } as any);
        const ap = await bounties.apply(b.id, expert.id, { message: `${s.title.replace('[사례] ', '')} 경험이 있습니다.` });
        await bounties.selectApplicant(b.id, ap.id, client.id);
        await bounties.confirmPayment(b.id, client.id);
        await bounties.submitResult(b.id, expert.id, '/uploads/mock-result-case.pdf', '요청하신 작업을 마치고 결과 보고서를 첨부합니다.');

        if (s.outcome === 'SUCCESS') {
          await bounties.approve(b.id, client.id);
        } else {
          const d = await disputes.file(b.id, client.id, { reason: s.disputeReason! });
          if (s.outcome === 'DISPUTE_SETTLE') await disputes.resolve(d.id, s.adminNote!, false);
          if (s.outcome === 'REFUND') await disputes.resolve(d.id, s.adminNote!, true);
        }
        if (s.rating !== undefined && (s.outcome === 'SUCCESS' || s.outcome === 'DISPUTE_SETTLE')) {
          await bounties.rate(b.id, client.id, { rating: s.rating, note: s.note } as any);
        }
        // 시간 흐름: 소요 일수와 종결 시점을 과거로 옮긴다 (시스템 점수의 '소요 기간'이 갈리도록)
        const end = new Date(Date.now() - s.daysAgo * 86_400_000);
        const start = new Date(end.getTime() - s.takenDays * 86_400_000);
        await ds.query(`UPDATE bounties SET "createdAt" = $1, "updatedAt" = $2 WHERE id = $3`, [start, end, b.id]);
        made++;
        console.log(`[${s.outcome}${s.rating !== undefined ? ` · 의뢰인 ${s.rating}` : ''}] ${s.title}`);
      } catch (e: any) {
        console.log(`실패(건너뜀): ${s.title} - ${e?.message ?? e}`);
      }
    }

    // ── 이미 있던 시연 거래(seed-demo / seed-demo-match가 만든 건)도 같은 모습으로 다양화 ──
    // 방금 만든 거래는 "처리 0일, 의뢰인 평가 전"으로 모두 똑같이 보이므로, 의뢰인 평가가 없는 정산 건에
    // 건마다 다른 평가·처리 기간·시점을 준다. bounty id에서 값을 정하므로 여러 번 실행해도 결과가 같다.
    const RATINGS: (number | null)[] = [10, 9.5, 9, 9, 8.5, 8, 8, 7.5, 7, 6.5, 6, 5.5, 4.5, null, null, null];
    const NOTES: Record<number, string> = {
      10: '설명이 꼼꼼하고 결과물이 기대 이상이었어요.',
      9: '약속한 일정에 맞춰 깔끔하게 마무리해 주셨습니다.',
      8: '만족합니다. 다음에도 맡기고 싶어요.',
      7: '무난했어요. 소통이 조금만 더 빨랐으면 좋겠습니다.',
      6: '결과는 괜찮았지만 처음 설명과 약간 달랐습니다.',
      5: '기대보다 아쉬웠고 보완 요청이 필요했어요.',
    };
    const old: { id: string }[] = await ds.query(
      `SELECT b.id FROM bounties b WHERE b.status = 'SETTLED' AND b."clientRating" IS NULL AND b.title NOT LIKE '[사례]%' ORDER BY b.id`,
    );
    let polished = 0;
    for (const row of old) {
      const h = parseInt(row.id.replace(/-/g, '').slice(0, 8), 16);
      const rating = RATINGS[h % RATINGS.length];
      const takenDays = 1 + (Math.floor(h / 7) % 11); // 1~11일
      const daysAgo = 1 + (Math.floor(h / 131) % 70); // 1~70일 전
      const end = new Date(Date.now() - daysAgo * 86_400_000);
      const start = new Date(end.getTime() - takenDays * 86_400_000);
      const note = rating !== null ? NOTES[Math.floor(rating)] ?? null : null;
      await ds.query(
        `UPDATE bounties SET "createdAt" = $1, "updatedAt" = $2, "clientRating" = $3, "clientRatingNote" = $4 WHERE id = $5`,
        [start, end, rating, note, row.id],
      );
      polished++;
    }
    console.log(`기존 정산 거래 ${polished}건의 평가·처리 기간·시점을 다양하게 조정했습니다.`);
    console.log(`\n거래 사례 시연 데이터 ${made}건 생성 완료. 거래 사례 화면(/cases)에서 확인하세요.`);
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('거래 사례 시연 데이터 생성 실패:', err);
  process.exit(1);
});
