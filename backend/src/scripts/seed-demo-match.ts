import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';
import { CertificationsService } from '../modules/certifications/certifications.service';
import { BountiesService } from '../modules/bounties/bounties.service';
import { UserRole } from '../common/enums/user-role.enum';
import { DomainType } from '../common/enums/domain-type.enum';
import { ServiceType } from '../common/enums/service-type.enum';
import { VerificationTrack } from '../common/enums/verification-track.enum';

/**
 * AI 매칭 시연용 데이터: 같은 분야 안에서 "이력이 서로 다른" 전문가를 만든다.
 *  - 점수가 사람마다 갈려야 매칭이 실제로 변별하는지 눈으로 확인할 수 있기 때문이다.
 *  - 완료(SETTLED) 프로젝트 이력은 서비스 로직(지원→선택→결제→제출→승인)을 그대로 타서 만든다.
 *  - 모집 중(PENDING) 프로젝트도 몇 개 만들어 "전문가 → 의뢰 추천"도 확인할 수 있게 한다.
 * 사용법: npm run seed-demo-match   (seed-demo 이후에 실행. 로컬 시연 전용)
 */
const EXPERT_PASSWORD = 'ExpertDemo123!@#';

const EXPERTS = [
  { email: 'match-db1@demo.com', name: '윤서진', domain: DomainType.BACKEND_DB_TUNING, license: 'MATCH-LICENSE-030',
    history: [
      ['주문 테이블 인덱스 재설계와 슬로우 쿼리 개선', '주문 목록 조회가 느려 실행계획을 분석하고 복합 인덱스를 설계했습니다.', 280000],
      ['통계 집계 쿼리 실행계획 최적화', '대시보드 집계 쿼리의 풀스캔을 제거하고 응답시간을 비교표로 정리했습니다.', 320000],
      ['MySQL 조인 쿼리 성능 튜닝', '다중 조인 쿼리의 인덱스와 조인 순서를 개선했습니다.', 250000],
    ] },
  { email: 'match-db2@demo.com', name: '한지호', domain: DomainType.BACKEND_DB_TUNING, license: 'MATCH-LICENSE-031',
    history: [
      ['Redis 캐시 도입으로 API 응답 단축', '조회 API에 캐시 계층을 도입하고 무효화 전략을 정리했습니다.', 300000],
      ['서버 배포 파이프라인 구축', '무중단 배포 자동화 파이프라인을 구축했습니다.', 350000],
    ] },
  { email: 'match-db3@demo.com', name: '오세린', domain: DomainType.BACKEND_DB_TUNING, license: 'MATCH-LICENSE-032', history: [] as any[] },
  { email: 'match-dev1@demo.com', name: '서하준', domain: DomainType.DEV_CODE_REVIEW, license: 'MATCH-LICENSE-034',
    history: [
      ['결제 모듈 보안 취약점 코드 리뷰', 'SQL 인젝션과 권한 검증 누락을 점검하고 개선안을 제시했습니다.', 400000],
      ['Spring 서비스 계층 리팩터링 리뷰', '서비스 계층 책임 분리와 트랜잭션 경계를 리뷰했습니다.', 300000],
    ] },
  { email: 'match-car1@demo.com', name: '이도현', domain: DomainType.VEHICLE_DIAGNOSTICS, license: 'MATCH-LICENSE-038',
    history: [
      ['중고 SUV 사고 이력·침수 여부 현장 동행 점검', '구매 전 현장에서 사고 수리 흔적, 침수 여부, 하부 부식을 점검했습니다.', 150000, true],
      ['중고 세단 엔진·변속기 정밀 진단 동행', '시운전 동행으로 엔진 소음과 변속 충격을 진단하고 견적서를 정리했습니다.', 180000, true],
      ['수입 중고차 계약 전 동행검증', '성능기록부와 실차 상태를 대조해 불일치 항목을 보고했습니다.', 200000, true],
    ] },
  { email: 'match-car2@demo.com', name: '정유나', domain: DomainType.VEHICLE_DIAGNOSTICS, license: 'MATCH-LICENSE-039',
    history: [
      ['전기차 배터리 상태 진단 보고서', '배터리 SOH와 충전 이력을 분석해 잔존 수명 보고서를 작성했습니다.', 160000],
      ['중고 화물차 정비 이력 확인', '정비 이력과 주행거리 조작 여부를 확인했습니다.', 120000],
    ] },
  { email: 'match-re1@demo.com', name: '강민재', domain: DomainType.REAL_ESTATE_TITLE_ANALYSIS, license: 'MATCH-LICENSE-041',
    history: [
      ['빌라 근저당·전세보증금 위험 권리분석 임장', '등기부 근저당과 선순위 보증금을 분석하고 현장 임장으로 실제 점유 상태를 확인했습니다.', 250000, true],
      ['상가 임차 전 등기부 권리분석', '임차 전 소유권과 권리 제한 사항을 분석했습니다.', 200000],
      ['경매 물건 임장 대행 및 권리분석', '경매 물건의 현장 상태와 인수 권리를 확인해 보고서를 작성했습니다.', 300000, true],
    ] },
  { email: 'match-re2@demo.com', name: '신다은', domain: DomainType.REAL_ESTATE_TITLE_ANALYSIS, license: 'MATCH-LICENSE-042',
    history: [
      ['오피스텔 전세사기 위험 등기부 점검', '등기부와 건축물대장을 대조해 전세사기 위험 신호를 점검했습니다.', 180000],
      ['토지 임장 현장 확인', '토지 경계와 도로 접합 상태를 현장에서 확인했습니다.', 220000, true],
    ] },
  { email: 'match-re3@demo.com', name: '배정훈', domain: DomainType.REAL_ESTATE_TITLE_ANALYSIS, license: 'MATCH-LICENSE-043', history: [] as any[] },
  { email: 'match-dev2@demo.com', name: '문가영', domain: DomainType.DEV_CODE_REVIEW, license: 'MATCH-LICENSE-037',
    history: [
      ['React 프론트엔드 렌더링 성능 코드 리뷰', '불필요한 리렌더링과 상태 구조를 점검했습니다.', 260000],
      ['테스트 커버리지 개선 코드 리뷰', '단위 테스트 구조와 모킹 전략을 리뷰했습니다.', 220000],
    ] },
];

const OPEN_BOUNTIES: {
  guard: string; domain: DomainType; title: string; description: string; amount: number;
  companion?: { location: string; daysAhead: number };
}[] = [
  { guard: 'match-car1@demo.com', domain: DomainType.VEHICLE_DIAGNOSTICS, title: '중고 SUV 구매 전 현장 동행 점검',
    description: '다음 주 중고차 단지에서 구매 예정인 SUV의 사고 이력, 침수 여부, 하부 상태를 함께 보고 판단해 주세요.', amount: 170000,
    companion: { location: '서울 성동구 중고차 매매단지 입구', daysAhead: 5 } },
  { guard: 'match-car1@demo.com', domain: DomainType.VEHICLE_DIAGNOSTICS, title: '중고 전기차 배터리 상태 원격 진단',
    description: '구매 검토 중인 중고 전기차의 배터리 진단 자료를 보내드리면 잔존 수명과 위험 요소를 정리해 주세요.', amount: 140000 },
  { guard: 'match-re1@demo.com', domain: DomainType.REAL_ESTATE_TITLE_ANALYSIS, title: '빌라 전세 계약 전 근저당·보증금 위험 확인',
    description: '전세 계약 직전인 빌라의 등기부 근저당과 선순위 보증금을 분석하고 계약해도 되는지 위험 요소를 정리해 주세요.', amount: 220000 },
  { guard: 'match-re1@demo.com', domain: DomainType.REAL_ESTATE_TITLE_ANALYSIS, title: '경매 아파트 현장 임장 대행 및 권리분석',
    description: '경매 예정 아파트의 현장 상태, 점유 현황, 인수해야 할 권리를 확인해 임장 보고서로 정리해 주세요.', amount: 320000,
    companion: { location: '경기 성남시 분당구 해당 아파트 단지 정문', daysAhead: 7 } },
  { guard: 'match-db1@demo.com', domain: DomainType.BACKEND_DB_TUNING, title: '회원 주문 이력 조회 쿼리 인덱스 개선',
    description: '회원별 주문 이력 조회가 3초 이상 걸립니다. 실행계획을 분석해 인덱스 개선안과 개선 전후 응답시간 비교표를 제출해 주세요.', amount: 300000 },
  { guard: 'match-db1@demo.com', domain: DomainType.BACKEND_DB_TUNING, title: '조회 API 캐시 전략 점검',
    description: '트래픽이 늘어 조회 API가 느립니다. 캐시 도입 위치와 무효화 방식을 제안해 주세요.', amount: 260000 },
  { guard: 'match-dev1@demo.com', domain: DomainType.DEV_CODE_REVIEW, title: '결제 모듈 SQL 인젝션 점검 코드 리뷰',
    description: '결제 모듈의 쿼리 작성 방식과 입력 검증을 점검하고 취약점 목록과 개선안을 정리해 주세요.', amount: 350000 },
  { guard: 'match-dev1@demo.com', domain: DomainType.DEV_CODE_REVIEW, title: '리액트 대시보드 렌더링 성능 리뷰',
    description: '대시보드 화면이 느립니다. 컴포넌트 구조와 상태 관리를 리뷰하고 개선안을 제안해 주세요.', amount: 240000 },
];

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    console.error('운영 환경에서는 실행할 수 없습니다.');
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const users = app.get(UsersService);
    const certs = app.get(CertificationsService);
    const bounties = app.get(BountiesService);

    const client3 = await users.findByEmail('client3@demo.com');
    const client1 = await users.findByEmail('client@demo.com');
    if (!client3 || !client1) {
      console.error('먼저 `npm run seed-demo`를 실행해 주세요 (의뢰인 데모 계정이 필요합니다).');
      process.exit(1);
    }

    // 전문가별로 멱등: 이미 있는 전문가는 건너뛰므로 여러 번 실행해도 중복이 생기지 않는다.
    const created = new Set<string>();
    for (const e of EXPERTS) {
      if (await users.findByEmail(e.email)) {
        console.log(`건너뜀(이미 있음): ${e.email}`);
        continue;
      }
      const u = await users.create({
        email: e.email,
        passwordHash: await bcrypt.hash(EXPERT_PASSWORD, 10),
        name: e.name,
        role: UserRole.EXPERT,
        ciHash: crypto.randomBytes(32).toString('hex'),
        emailVerifiedAt: new Date(),
      });
      const cert = await certs.submit(u.id, { domainType: e.domain, track: VerificationTrack.STANDARD, licenseNumber: e.license });
      created.add(e.email);
      console.log(`전문가: ${u.email} (${e.name}) 인증 ${cert.verifiedStatus}`);
      for (const [title, description, amount, companion] of e.history as [string, string, number, boolean?][]) {
        const b = await bounties.create(client3.id, {
          domainType: e.domain,
          title,
          description,
          bountyAmount: amount,
          ...(companion
            ? {
                serviceType: ServiceType.COMPANION,
                companionLocation: '현장 동행 장소(시연용)',
                companionMeetingAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
              }
            : {}),
        } as any);
        const app1 = await bounties.apply(b.id, u.id, { message: `${title} 경험이 있습니다.` });
        await bounties.selectApplicant(b.id, app1.id, client3.id);
        await bounties.confirmPayment(b.id, client3.id);
        await bounties.submitResult(b.id, u.id, '/uploads/mock-result-match-demo.pdf', `${title} 작업을 완료했고 결과 보고서를 첨부합니다.`);
        await bounties.approve(b.id, client3.id);
        console.log(`  [SETTLED${companion ? '·동행' : ''}] ${title}`);
      }
    }
    for (const o of OPEN_BOUNTIES) {
      if (!created.has(o.guard)) continue; // 새로 만든 전문가 분야의 모집 중 프로젝트만 만든다
      const b = await bounties.create(client1.id, {
        domainType: o.domain,
        title: o.title,
        description: o.description,
        bountyAmount: o.amount,
        ...(o.companion
          ? {
              serviceType: ServiceType.COMPANION,
              companionLocation: o.companion.location,
              companionMeetingAt: new Date(Date.now() + o.companion.daysAhead * 86_400_000).toISOString(),
            }
          : {}),
      } as any);
      console.log(`[PENDING${o.companion ? '·동행' : ''}] ${b.title}`);
    }
    console.log('\n매칭 시연 데이터 생성 완료. 전문가 비밀번호는 seed-demo와 같습니다.');
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('매칭 시연 데이터 생성 실패:', err);
  process.exit(1);
});
