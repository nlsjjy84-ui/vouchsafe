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

/**
 * 로컬 개발 환경을 처음 켰을 때 빈 화면만 보이는 문제를 해결하기 위한 1회성 데모 데이터 시드 스크립트.
 * 실제 회원가입 → 이메일 인증 → 로그인 흐름을 그대로 타지 않고, 관리자 스크립트(create-admin.ts)와
 * 같은 방식으로 Nest 애플리케이션 컨텍스트에 직접 접근해 "이미 이메일 인증까지 끝난" 계정들과
 * 승인된 전문가 인증, 그리고 PENDING/LOCKED/SUBMITTED/SETTLED/DISPUTED 다섯 가지 상태를
 * 전부 보여주는 프로젝트들을 한 번에 만들어 넣는다 (화면 시연/포트폴리오용 - 상태별 화면이
 * 전부 최소 1개씩은 채워져 있어야 UI를 점검하고 꾸미기가 수월하다).
 *
 * 사용법: npm run seed-demo
 */

const CLIENTS = [
  { email: 'client@demo.com', name: '김의뢰' },
  { email: 'client2@demo.com', name: '이지은' },
  { email: 'client3@demo.com', name: '박준혁' },
];

const EXPERTS = [
  { email: 'expert@demo.com', name: '박전문', domain: DomainType.DEV_CODE_REVIEW, license: 'EXPERT-LICENSE-001' },
  { email: 'expert2@demo.com', name: '최도윤', domain: DomainType.BACKEND_DB_TUNING, license: 'EXPERT-LICENSE-004' },
  { email: 'expert3@demo.com', name: '정하나', domain: DomainType.BUILDING_DEFECT_INSPECTION, license: 'EXPERT-LICENSE-005' },
  { email: 'expert4@demo.com', name: '강민서', domain: DomainType.STARTUP_CONTRACT_REVIEW, license: 'EXPERT-LICENSE-006' },
];

const CLIENT_PASSWORD = 'ClientDemo123!@#';
const EXPERT_PASSWORD = 'ExpertDemo123!@#';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const usersService = app.get(UsersService);
    const certificationsService = app.get(CertificationsService);
    const bountiesService = app.get(BountiesService);
    const disputesService = app.get(DisputesService, { strict: false });

    const existingClient = await usersService.findByEmail(CLIENTS[0].email);
    if (existingClient) {
      console.log('이미 데모 데이터가 존재하는 것 같습니다 (client@demo.com 계정이 이미 있음).');
      console.log('처음부터 다시 만들고 싶다면 DB를 초기화한 뒤 다시 실행해주세요.');
      return;
    }

    // 1. 의뢰인 계정 3개
    const clients: Record<string, { id: string; email: string }> = {};
    for (const c of CLIENTS) {
      const user = await usersService.create({
        email: c.email,
        passwordHash: await bcrypt.hash(CLIENT_PASSWORD, SALT_ROUNDS),
        name: c.name,
        role: UserRole.CLIENT,
        ciHash: crypto.randomBytes(32).toString('hex'),
        emailVerifiedAt: new Date(),
      });
      clients[c.email] = user;
      console.log(`의뢰인 계정 생성: ${user.email} (${c.name}) / 비밀번호: ${CLIENT_PASSWORD}`);
    }

    // 2. 전문가 계정 4개 + 도메인별 승인된 자격 인증
    const experts: Record<string, { id: string; email: string }> = {};
    for (const e of EXPERTS) {
      const user = await usersService.create({
        email: e.email,
        passwordHash: await bcrypt.hash(EXPERT_PASSWORD, SALT_ROUNDS),
        name: e.name,
        role: UserRole.EXPERT,
        ciHash: crypto.randomBytes(32).toString('hex'),
        emailVerifiedAt: new Date(),
      });
      experts[e.email] = user;
      const cert = await certificationsService.submit(user.id, {
        domainType: e.domain,
        track: VerificationTrack.STANDARD,
        licenseNumber: e.license,
      });
      console.log(
        `전문가 계정 생성: ${user.email} (${e.name}, ${e.domain}) - 인증 상태: ${cert.verifiedStatus}`,
      );
    }

    const c1 = clients['client@demo.com'];
    const c2 = clients['client2@demo.com'];
    const c3 = clients['client3@demo.com'];
    const x1 = experts['expert@demo.com']; // DEV_CODE_REVIEW
    const x2 = experts['expert2@demo.com']; // BACKEND_DB_TUNING
    const x3 = experts['expert3@demo.com']; // BUILDING_DEFECT_INSPECTION
    const x4 = experts['expert4@demo.com']; // STARTUP_CONTRACT_REVIEW

    // 3. PENDING - 지원자 있음 (지원자 목록/선택 화면용)
    const bPendingMulti = await bountiesService.create(c1.id, {
      domainType: DomainType.DEV_CODE_REVIEW,
      title: '레거시 결제 모듈 코드 리뷰 요청',
      description: '3년 전에 작성된 결제 모듈 코드베이스 전체를 리뷰하고, 잠재적인 버그와 보안 취약점을 정리해주세요.',
      bountyAmount: 500000,
    });
    await bountiesService.apply(bPendingMulti.id, x1.id, {
      message: '결제 도메인 코드 리뷰 경험이 많습니다. 꼼꼼히 살펴보겠습니다.',
    });
    console.log(`[PENDING] "${bPendingMulti.title}" 등록 + 지원 1건`);

    // 4. PENDING - 지원자 없음 (빈 상태 화면용)
    const bPendingEmpty = await bountiesService.create(c1.id, {
      domainType: DomainType.STARTUP_CONTRACT_REVIEW,
      title: '스타트업 근로계약서 표준양식 검토',
      description: '초기 스타트업용 표준 근로계약서 초안을 작성했는데, 법적으로 문제 없는지 검토해주세요.',
      bountyAmount: 200000,
    });
    console.log(`[PENDING] "${bPendingEmpty.title}" 등록 (아직 지원자 없음)`);

    // 5. PENDING - DB 튜닝
    const bPendingDb = await bountiesService.create(c1.id, {
      domainType: DomainType.BACKEND_DB_TUNING,
      title: '느려진 대시보드 쿼리 튜닝',
      description: '집계 대시보드 페이지 로딩이 5초 이상 걸립니다. 쿼리와 인덱스를 점검해주세요.',
      bountyAmount: 300000,
    });
    console.log(`[PENDING] "${bPendingDb.title}" 등록`);

    // 6. LOCKED - 선택 완료, 아직 제출 전 (진행중 화면용)
    const bLocked = await bountiesService.create(c3.id, {
      domainType: DomainType.STARTUP_CONTRACT_REVIEW,
      title: '투자 계약서(SAFE) 검토 요청',
      description: '초기 투자 유치용 SAFE 계약서 초안을 받았는데, 불리한 조항이 없는지 검토해주세요.',
      bountyAmount: 350000,
    });
    const appLocked = await bountiesService.apply(bLocked.id, x4.id, {
      message: 'SAFE 계약서 검토 다수 진행해봤습니다.',
    });
    await bountiesService.selectApplicant(bLocked.id, appLocked.id, c3.id);
    console.log(`[LOCKED] "${bLocked.title}" - ${x4.email} 선택, 에스크로 락업`);

    // 7. SUBMITTED - 결과물 제출 완료, 의뢰인 승인 대기 (승인 화면용)
    const bSubmitted = await bountiesService.create(c2.id, {
      domainType: DomainType.BACKEND_DB_TUNING,
      title: '회원 검색 API 응답속도 개선',
      description: '회원 검색 API가 1000건 이상일 때 3초 넘게 걸립니다. 인덱스/쿼리 개선 부탁드립니다.',
      bountyAmount: 400000,
    });
    const appSubmitted = await bountiesService.apply(bSubmitted.id, x2.id, {
      message: 'DB 튜닝 전문입니다. EXPLAIN ANALYZE부터 확인하겠습니다.',
    });
    await bountiesService.selectApplicant(bSubmitted.id, appSubmitted.id, c2.id);
    await bountiesService.submitResult(
      bSubmitted.id,
      x2.id,
      '/uploads/mock-result-query-tuning-report.pdf',
      '복합 인덱스 추가 및 N+1 쿼리 제거로 평균 응답속도를 2.8초 → 0.3초로 개선했습니다. 상세 내역은 첨부 리포트 참고해주세요.',
    );
    console.log(`[SUBMITTED] "${bSubmitted.title}" - 결과물 제출 완료, 승인 대기중`);

    // 8. SETTLED - 승인까지 완료된 전체 라이프사이클 (완료 화면/정산 내역용)
    const bSettled = await bountiesService.create(c2.id, {
      domainType: DomainType.BUILDING_DEFECT_INSPECTION,
      title: '신축 빌라 누수 의심 정밀진단',
      description: '입주 3개월차 빌라 천장에 누수 흔적이 있습니다. 원인 진단과 하자보수 범위를 확인해주세요.',
      bountyAmount: 250000,
    });
    const appSettled = await bountiesService.apply(bSettled.id, x3.id, {
      message: '건축물 하자 진단 경험 다수 있습니다. 방문 진단 가능합니다.',
    });
    await bountiesService.selectApplicant(bSettled.id, appSettled.id, c2.id);
    await bountiesService.submitResult(
      bSettled.id,
      x3.id,
      '/uploads/mock-result-defect-inspection-report.pdf',
      '누수 원인은 옥상 방수층 시공 불량으로 확인되었습니다. 하자보수 범위 및 시공사 통보용 진단서 첨부합니다.',
    );
    await bountiesService.approve(bSettled.id, c2.id);
    console.log(`[SETTLED] "${bSettled.title}" - 승인 및 정산 완료`);

    // 9. DISPUTED - 제출 후 의뢰인이 이의제기 (분쟁 처리 화면용)
    const bDisputed = await bountiesService.create(c3.id, {
      domainType: DomainType.BACKEND_DB_TUNING,
      title: '결제 배치 스케줄러 성능 이슈',
      description: '심야 배치 스케줄러가 타임아웃으로 자주 실패합니다. 원인 분석과 개선을 부탁드립니다.',
      bountyAmount: 320000,
    });
    const appDisputed = await bountiesService.apply(bDisputed.id, x2.id, {
      message: '배치 처리 성능 튜닝 다수 경험 있습니다.',
    });
    await bountiesService.selectApplicant(bDisputed.id, appDisputed.id, c3.id);
    await bountiesService.submitResult(
      bDisputed.id,
      x2.id,
      '/uploads/mock-result-batch-scheduler.pdf',
      '배치 트랜잭션 크기를 줄이고 재시도 로직을 추가했습니다.',
    );
    if (disputesService) {
      await disputesService.file(bDisputed.id, c3.id, {
        reason: '제출된 결과물을 적용해도 여전히 타임아웃이 발생합니다. 근본 원인 파악이 안 된 것 같습니다.',
      });
      console.log(`[DISPUTED] "${bDisputed.title}" - 의뢰인 이의제기 접수`);
    } else {
      console.log(`[SUBMITTED] "${bDisputed.title}" - (DisputesService를 찾지 못해 분쟁 전환은 건너뜀)`);
    }

    console.log('\n=== 데모 데이터 생성 완료 ===');
    console.log('의뢰인 로그인:');
    for (const c of CLIENTS) console.log(`  - ${c.email} / ${CLIENT_PASSWORD} (${c.name})`);
    console.log('전문가 로그인:');
    for (const e of EXPERTS) console.log(`  - ${e.email} / ${EXPERT_PASSWORD} (${e.name})`);
    console.log('브라우저에서 localhost:3000 새로고침 후 로그인해서 확인해보세요.');
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('데모 데이터 생성 실패:', err);
  process.exit(1);
});
