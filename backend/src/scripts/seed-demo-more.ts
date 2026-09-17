import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';
import { CertificationsService } from '../modules/certifications/certifications.service';
import { BountiesService } from '../modules/bounties/bounties.service';
import { DisputesService } from '../modules/disputes/disputes.service';
import { UserRole } from '../common/enums/user-role.enum';
import { DomainType } from '../common/enums/domain-type.enum';
import { VerificationTrack } from '../common/enums/verification-track.enum';

const SALT_ROUNDS = 10;
const CLIENT_PASSWORD = 'ClientDemo123!@#';
const EXPERT_PASSWORD = 'ExpertDemo123!@#';

/**
 * =========================================================================
 * seed-demo.ts를 실행한 뒤에 "화면 데모/포트폴리오용으로 데이터가 너무 적다"는
 * 피드백을 반영해 추가로 얹는 2차 시드 스크립트.
 * =========================================================================
 * seed-demo.ts가 이미 만들어둔 의뢰인 3명 + 전문가 4명(도메인 4개)은 건드리지 않고,
 * 그 위에 의뢰인 12명 + 전문가 11명을 더 만들어 "의뢰인 15명 / 전문가 15명, 15개
 * 도메인에 전문가 1명씩 배치"를 완성한다. 그 다음 도메인마다 바운티를 2건씩(총 30건)
 * 만들어서 PENDING(지원자 없음/있음)·LOCKED·SUBMITTED·SETTLED·DISPUTED 5가지 상태가
 * 골고루 섞이게 한다 - 목록/상세/마이페이지/AI 인사이트/관리자 분쟁중재 화면이 전부
 * "실제로 쓰이고 있는 서비스"처럼 보이도록 하는 게 목적이다.
 *
 * 사용법: npm run seed-demo-more (package.json에 스크립트 추가 필요 - 혹은
 *         npx ts-node -r tsconfig-paths/register src/scripts/seed-demo-more.ts)
 * =========================================================================
 */

const NEW_CLIENTS = [
  { email: 'client4@demo.com', name: '오세영' },
  { email: 'client5@demo.com', name: '한지민' },
  { email: 'client6@demo.com', name: '윤도현' },
  { email: 'client7@demo.com', name: '서지우' },
  { email: 'client8@demo.com', name: '임하늘' },
  { email: 'client9@demo.com', name: '조은비' },
  { email: 'client10@demo.com', name: '배성민' },
  { email: 'client11@demo.com', name: '신유리' },
  { email: 'client12@demo.com', name: '문재현' },
  { email: 'client13@demo.com', name: '양소희' },
  { email: 'client14@demo.com', name: '구태윤' },
  { email: 'client15@demo.com', name: '노은서' },
];

const NEW_EXPERTS: Array<{ email: string; name: string; domain: DomainType; license: string }> = [
  { email: 'expert5@demo.com', name: '김태양', domain: DomainType.WEB3_SECURITY_AUDIT, license: 'EXPERT-LICENSE-007' },
  { email: 'expert6@demo.com', name: '이수빈', domain: DomainType.CRAWLING_ARCHITECTURE, license: 'EXPERT-LICENSE-009' },
  { email: 'expert7@demo.com', name: '박현우', domain: DomainType.MOBILE_QA_AUTOMATION, license: 'EXPERT-LICENSE-010' },
  { email: 'expert8@demo.com', name: '최유진', domain: DomainType.TECH_CREATOR_CONSULTING, license: 'EXPERT-LICENSE-011' },
  { email: 'expert9@demo.com', name: '정민석', domain: DomainType.AUDIO_MASTERING_REVIEW, license: 'EXPERT-LICENSE-013' },
  { email: 'expert10@demo.com', name: '강다은', domain: DomainType.INDIE_GAME_QA, license: 'EXPERT-LICENSE-014' },
  { email: 'expert11@demo.com', name: '조현민', domain: DomainType.GRAPHICS_3D_OPTIMIZATION, license: 'EXPERT-LICENSE-015' },
  { email: 'expert12@demo.com', name: '임서준', domain: DomainType.VEHICLE_DIAGNOSTICS, license: 'EXPERT-LICENSE-016' },
  { email: 'expert13@demo.com', name: '한소율', domain: DomainType.FIRE_SAFETY_INSPECTION, license: 'EXPERT-LICENSE-018' },
  { email: 'expert14@demo.com', name: '배지훈', domain: DomainType.TAX_STRUCTURE_FACTCHECK, license: 'EXPERT-LICENSE-019' },
  { email: 'expert15@demo.com', name: '송예린', domain: DomainType.REAL_ESTATE_TITLE_ANALYSIS, license: 'EXPERT-LICENSE-021' },
];

// 기존 전문가 3명에게 "두 번째 자격 인증"을 하나씩 더 얹어서 인증 상태(승인/보류/반려)가
// 골고루 보이게 한다 - 이 인증들은 바운티 지원에는 안 쓰고 순수하게 "인증 내역 화면"의
// 상태 다양성을 위한 것이다.
const EXTRA_CERTS: Array<{ expertEmail: string; domain: DomainType; license: string }> = [
  { expertEmail: 'expert2@demo.com', domain: DomainType.MOBILE_QA_AUTOMATION, license: 'EXPERT-LICENSE-012' }, // PENDING
  { expertEmail: 'expert3@demo.com', domain: DomainType.TAX_STRUCTURE_FACTCHECK, license: 'EXPERT-LICENSE-008' }, // PENDING
  { expertEmail: 'expert4@demo.com', domain: DomainType.REAL_ESTATE_TITLE_ANALYSIS, license: 'BAD' }, // REJECTED (형식검증 실패)
];

// 도메인마다 "이 도메인 지원 자격을 가진 전문가"를 정확히 1명씩 매칭 (15개 도메인 = 15명)
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

type BountyStatusTarget = 'PENDING_EMPTY' | 'PENDING_APPLIED' | 'LOCKED' | 'SUBMITTED' | 'SETTLED' | 'DISPUTED';
const STATUS_CYCLE: BountyStatusTarget[] = [
  'PENDING_EMPTY',
  'PENDING_APPLIED',
  'LOCKED',
  'SUBMITTED',
  'SETTLED',
  'DISPUTED',
];

interface BountySeed {
  title: string;
  description: string;
  amount: number;
}

// 도메인마다 바운티 2건(A, B)씩 - 총 15 * 2 = 30건
const BOUNTY_PLAN: Record<DomainType, [BountySeed, BountySeed]> = {
  [DomainType.BACKEND_DB_TUNING]: [
    { title: '회원 통계 집계 쿼리 응답 지연 개선', description: '관리자 대시보드의 회원 통계 집계 쿼리가 5초 이상 걸립니다. 인덱스와 쿼리 구조를 점검해주세요.', amount: 350000 },
    { title: '결제 로그 테이블 파티셔닝 검토', description: '결제 로그 테이블이 수천만 건으로 커지면서 조회가 느려졌습니다. 파티셔닝 전략을 제안해주세요.', amount: 420000 },
  ],
  [DomainType.WEB3_SECURITY_AUDIT]: [
    { title: 'NFT 민팅 컨트랙트 보안 감사', description: '자체 배포 예정인 NFT 민팅 스마트컨트랙트의 취약점 여부를 감사해주세요.', amount: 600000 },
    { title: '스테이킹 컨트랙트 재진입 공격 점검', description: '스테이킹 보상 지급 로직에 재진입 공격 가능성이 있는지 점검이 필요합니다.', amount: 550000 },
  ],
  [DomainType.DEV_CODE_REVIEW]: [
    { title: '사내 결제 SDK 코드 리뷰', description: '신규 결제 SDK 코드베이스 전체를 리뷰하고 개선점을 정리해주세요.', amount: 400000 },
    { title: '레거시 인증 모듈 리팩터링 검토', description: '5년 된 인증 모듈을 리팩터링하려고 합니다. 구조 개선 방향을 검토해주세요.', amount: 380000 },
  ],
  [DomainType.CRAWLING_ARCHITECTURE]: [
    { title: '이커머스 가격 비교 크롤러 설계', description: '여러 쇼핑몰의 상품 가격을 주기적으로 수집하는 크롤러 아키텍처를 설계해주세요.', amount: 300000 },
    { title: '차단 우회용 크롤링 구조 점검', description: '운영 중인 크롤러가 자주 차단당합니다. 안정적인 수집 구조로 개선해주세요.', amount: 320000 },
  ],
  [DomainType.MOBILE_QA_AUTOMATION]: [
    { title: '안드로이드 결제 플로우 자동화 테스트', description: '앱 내 결제 플로우 전체에 대한 자동화 테스트 스크립트를 작성해주세요.', amount: 280000 },
    { title: 'iOS 알림 권한 시나리오 QA', description: '푸시 알림 권한 허용/거부 시나리오별 QA를 진행해주세요.', amount: 220000 },
  ],
  [DomainType.TECH_CREATOR_CONSULTING]: [
    { title: '개발 유튜브 채널 성장 전략 자문', description: '구독자 3천 명대 개발 유튜브 채널의 성장 전략을 자문해주세요.', amount: 250000 },
    { title: 'IT 크리에이터 수익화 구조 컨설팅', description: '강의/스폰서십 등 수익화 채널 다각화 방안을 컨설팅해주세요.', amount: 270000 },
  ],
  [DomainType.AUDIO_MASTERING_REVIEW]: [
    { title: '싱글 음원 마스터링 품질 검수', description: '발매 예정인 싱글 음원의 마스터링 품질을 검수해주세요.', amount: 200000 },
    { title: '팟캐스트 오디오 노이즈 제거 검증', description: '팟캐스트 녹음본의 배경 노이즈 제거 결과물을 검증해주세요.', amount: 150000 },
  ],
  [DomainType.INDIE_GAME_QA]: [
    { title: '인디 플랫포머 게임 밸런스 QA', description: '출시 예정 플랫포머 게임의 난이도 밸런스를 QA해주세요.', amount: 260000 },
    { title: '로그라이크 게임 버그 바운티 QA', description: '얼리액세스 로그라이크 게임의 크리티컬 버그를 찾아주세요.', amount: 240000 },
  ],
  [DomainType.GRAPHICS_3D_OPTIMIZATION]: [
    { title: '모바일 3D 캐릭터 폴리곤 최적화', description: '모바일 게임용 3D 캐릭터 에셋의 폴리곤 수를 최적화해주세요.', amount: 310000 },
    { title: '언리얼 라이트베이크 최적화 검토', description: '언리얼 엔진 라이트베이크 시간이 과도합니다. 최적화 방안을 검토해주세요.', amount: 330000 },
  ],
  [DomainType.VEHICLE_DIAGNOSTICS]: [
    { title: '중고차 구매 전 정밀 진단', description: '구매 예정인 중고차의 사고 이력과 기계적 상태를 정밀 진단해주세요.', amount: 180000 },
    { title: '주행 중 이상 소음 원인 진단', description: '고속 주행 시 발생하는 이상 소음의 원인을 진단해주세요.', amount: 160000 },
  ],
  [DomainType.BUILDING_DEFECT_INSPECTION]: [
    { title: '신축 오피스텔 하자 점검', description: '입주 예정인 신축 오피스텔의 사전점검 하자 여부를 확인해주세요.', amount: 250000 },
    { title: '베란다 확장 누수 정밀진단', description: '베란다 확장 공사 이후 누수가 의심됩니다. 원인을 진단해주세요.', amount: 270000 },
  ],
  [DomainType.FIRE_SAFETY_INSPECTION]: [
    { title: '상가 소방시설 정기점검', description: '운영 중인 상가 건물의 소방시설 정기점검을 진행해주세요.', amount: 220000 },
    { title: '물류창고 스프링클러 안전진단', description: '물류창고 스프링클러 설비의 안전 기준 충족 여부를 진단해주세요.', amount: 290000 },
  ],
  [DomainType.STARTUP_CONTRACT_REVIEW]: [
    { title: '초기 팀빌딩 지분 계약서 검토', description: '공동창업자 간 지분 계약서 초안의 법적 리스크를 검토해주세요.', amount: 320000 },
    { title: '프리랜서 용역계약서 독소조항 검토', description: '외주 개발사와 체결할 용역계약서에 독소조항이 있는지 검토해주세요.', amount: 210000 },
  ],
  [DomainType.TAX_STRUCTURE_FACTCHECK]: [
    { title: '1인 법인 절세 구조 팩트체크', description: '1인 법인 전환 시 절세 효과에 대한 사실관계를 팩트체크해주세요.', amount: 280000 },
    { title: '프리랜서 종합소득세 신고 검토', description: '프리랜서 종합소득세 신고 내역에 누락이 없는지 검토해주세요.', amount: 190000 },
  ],
  [DomainType.REAL_ESTATE_TITLE_ANALYSIS]: [
    { title: '오피스텔 매매 권리관계 분석', description: '매매 예정인 오피스텔의 등기부등본 권리관계를 분석해주세요.', amount: 230000 },
    { title: '상가 임대차 등기부 정밀분석', description: '상가 임대차 계약 전 등기부등본을 정밀분석해주세요.', amount: 200000 },
  ],
};

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  try {
    const usersService = app.get(UsersService);
    const certificationsService = app.get(CertificationsService);
    const bountiesService = app.get(BountiesService);
    const disputesService = app.get(DisputesService, { strict: false });

    const already = await usersService.findByEmail(NEW_CLIENTS[0].email);
    if (already) {
      console.log('추가 데모 데이터가 이미 존재하는 것 같습니다 (client4@demo.com 계정이 이미 있음). 종료합니다.');
      return;
    }

    // 0. seed-demo.ts가 이미 만들어둔 기존 계정들을 불러온다.
    const existingClientEmails = ['client@demo.com', 'client2@demo.com', 'client3@demo.com'];
    const existingExpertEmails = ['expert@demo.com', 'expert2@demo.com', 'expert3@demo.com', 'expert4@demo.com'];

    const usersByEmail = new Map<string, { id: string; email: string }>();
    for (const email of [...existingClientEmails, ...existingExpertEmails]) {
      const u = await usersService.findByEmail(email);
      if (!u) {
        console.log(`경고: 기존 계정 ${email}을 찾을 수 없습니다 - 먼저 npm run seed-demo를 실행해주세요.`);
        return;
      }
      usersByEmail.set(email, u);
    }

    // 1. 의뢰인 12명 추가 생성 (총 15명)
    for (const c of NEW_CLIENTS) {
      const user = await usersService.create({
        email: c.email,
        passwordHash: await bcrypt.hash(CLIENT_PASSWORD, SALT_ROUNDS),
        name: c.name,
        role: UserRole.CLIENT,
        ciHash: crypto.randomBytes(32).toString('hex'),
        emailVerifiedAt: new Date(),
      });
      usersByEmail.set(c.email, user);
      console.log(`의뢰인 계정 생성: ${user.email} (${c.name})`);
    }

    // 2. 전문가 11명 추가 생성 + 도메인별 승인 인증 (총 15명, 15개 도메인 커버리지 완성)
    for (const e of NEW_EXPERTS) {
      const user = await usersService.create({
        email: e.email,
        passwordHash: await bcrypt.hash(EXPERT_PASSWORD, SALT_ROUNDS),
        name: e.name,
        role: UserRole.EXPERT,
        ciHash: crypto.randomBytes(32).toString('hex'),
        emailVerifiedAt: new Date(),
      });
      usersByEmail.set(e.email, user);
      const cert = await certificationsService.submit(user.id, {
        domainType: e.domain,
        track: VerificationTrack.STANDARD,
        licenseNumber: e.license,
      });
      console.log(`전문가 계정 생성: ${user.email} (${e.name}, ${e.domain}) - 인증 상태: ${cert.verifiedStatus}`);
    }

    // 3. 기존 전문가 3명에게 두 번째 인증(상태 다양성용) 추가
    for (const ec of EXTRA_CERTS) {
      const user = usersByEmail.get(ec.expertEmail)!;
      const cert = await certificationsService.submit(user.id, {
        domainType: ec.domain,
        track: VerificationTrack.STANDARD,
        licenseNumber: ec.license,
      });
      console.log(`추가 인증 제출: ${ec.expertEmail} - ${ec.domain} - 상태: ${cert.verifiedStatus}`);
    }

    // 4. 전체 의뢰인 15명을 순서대로 순환시키며 도메인별 바운티 2건씩(총 30건) 생성
    const allClientEmails = [...existingClientEmails, ...NEW_CLIENTS.map((c) => c.email)];
    const domains = Object.keys(BOUNTY_PLAN) as DomainType[];

    let created = 0;
    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];
      const expert = usersByEmail.get(DOMAIN_EXPERT_EMAIL[domain])!;
      const [seedA, seedB] = BOUNTY_PLAN[domain];
      const clientA = usersByEmail.get(allClientEmails[i % allClientEmails.length])!;
      const clientB = usersByEmail.get(allClientEmails[(i + 7) % allClientEmails.length])!;
      const statusA = STATUS_CYCLE[(2 * i) % STATUS_CYCLE.length];
      const statusB = STATUS_CYCLE[(2 * i + 1) % STATUS_CYCLE.length];

      await runScenario(statusA, { client: clientA, expert, domain, seed: seedA, bountiesService, disputesService });
      created++;
      await runScenario(statusB, { client: clientB, expert, domain, seed: seedB, bountiesService, disputesService });
      created++;
    }

    console.log(`\n=== 추가 데모 데이터 생성 완료: 바운티 ${created}건 ===`);
    console.log(`의뢰인 15명 / 전문가 15명 (도메인 15개 전부 1명씩 커버) 준비 완료.`);
    console.log(`의뢰인 로그인 비밀번호: ${CLIENT_PASSWORD}`);
    console.log(`전문가 로그인 비밀번호: ${EXPERT_PASSWORD}`);
  } finally {
    await app.close();
  }
}

async function runScenario(
  status: BountyStatusTarget,
  opts: {
    client: { id: string };
    expert: { id: string };
    domain: DomainType;
    seed: BountySeed;
    bountiesService: BountiesService;
    disputesService: DisputesService;
  },
) {
  const { client, expert, domain, seed, bountiesService, disputesService } = opts;
  const bounty = await bountiesService.create(client.id, {
    domainType: domain,
    title: seed.title,
    description: seed.description,
    bountyAmount: seed.amount,
  });

  if (status === 'PENDING_EMPTY') {
    console.log(`[PENDING/지원없음] "${bounty.title}"`);
    return bounty;
  }

  const application = await bountiesService.apply(bounty.id, expert.id, {
    message: '해당 분야 경험이 있습니다. 꼼꼼히 진행하겠습니다.',
  });

  if (status === 'PENDING_APPLIED') {
    console.log(`[PENDING/지원있음] "${bounty.title}"`);
    return bounty;
  }

  await bountiesService.selectApplicant(bounty.id, application.id, client.id);
  if (status === 'LOCKED') {
    console.log(`[LOCKED] "${bounty.title}"`);
    return bounty;
  }

  await bountiesService.submitResult(
    bounty.id,
    expert.id,
    '/uploads/mock-result-report.pdf',
    '요청하신 작업을 완료했습니다. 첨부한 결과 리포트를 확인해주세요.',
  );
  if (status === 'SUBMITTED') {
    console.log(`[SUBMITTED] "${bounty.title}"`);
    return bounty;
  }

  if (status === 'DISPUTED') {
    if (disputesService) {
      await disputesService.file(bounty.id, client.id, {
        reason: '제출된 결과물이 처음 요청한 내용과 차이가 있어 확인이 필요합니다.',
      });
      console.log(`[DISPUTED] "${bounty.title}"`);
    } else {
      console.log(`[SUBMITTED] "${bounty.title}" (DisputesService를 찾지 못해 분쟁 전환 생략)`);
    }
    return bounty;
  }

  // SETTLED
  await bountiesService.approve(bounty.id, client.id);
  console.log(`[SETTLED] "${bounty.title}"`);
  return bounty;
}

bootstrap().catch((err) => {
  console.error('추가 데모 데이터 생성 실패:', err);
  process.exit(1);
});
