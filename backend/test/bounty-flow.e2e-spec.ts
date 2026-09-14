import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { MockEmailService } from '../src/mocks/mock-email.service';
import { UserRole } from '../src/common/enums/user-role.enum';
import { DomainType } from '../src/common/enums/domain-type.enum';
import { VerificationTrack } from '../src/common/enums/verification-track.enum';

/**
 * =========================================================================
 * bounty-flow.e2e-spec.ts — 바운티 에스크로 전체 생명주기를 실제 테스트 DB에
 * 대고 끝까지 검증한다.
 * =========================================================================
 * BountiesService의 핵심 상태전이(selectApplicant/confirmPayment/approve/
 * settleSubmittedBounty)는 전부 this.dataSource.transaction()으로 여러 테이블에
 * 걸쳐 원자적으로 처리되는데, 이걸 리포지토리 mock으로 흉내내려면 TypeORM의
 * QueryRunner/EntityManager 내부 동작까지 다 흉내내야 해서 실익보다 손이 훨씬
 * 많이 간다. 그래서 이 상태머신은 실제 DB로 처음부터 끝까지 한 번 흘려보내는
 * e2e 테스트로 검증하기로 했다 (auth.service.spec.ts의 순수 mock 유닛테스트와
 * 상호보완적인 전략 - PROGRESS.md 해당 섹션 참고).
 *
 * 흐름: 의뢰인/전문가 가입+인증 → 전문가 자격 인증(자동승인) → 바운티 등록 →
 * 지원 → 선택(결제대기) → 결제확인(락업) → 결과물 제출 → 승인(정산) →
 * 최종 상태 및 수수료 계산 검증. 그 사이사이 "권한 없는 사용자의 시도는
 * 막혀야 한다"도 같이 확인한다.
 * =========================================================================
 */
describe('Bounty escrow flow (e2e)', () => {
  let app: INestApplication;
  const verificationLinksByEmail = new Map<string, string>();

  const fakeMockEmail = {
    sendVerificationEmail: (email: string, link: string) => {
      verificationLinksByEmail.set(email, link);
    },
    sendPasswordResetEmail: () => {
      /* 이 테스트에서는 쓰지 않음 */
    },
  };

  const extractToken = (link: string): string => new URL(link).searchParams.get('token') as string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MockEmailService)
      .useValue(fakeMockEmail)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const strongPassword = 'FlowTestStrongPassw0rd!!';

  /** 회원가입 → 인증메일 링크에서 토큰 추출 → 인증 → 로그인까지 한번에 처리 */
  async function registerVerifiedUser(role: UserRole): Promise<{ email: string; userId: string; token: string }> {
    const email = `e2e-flow-${role.toLowerCase()}-${randomUUID()}@example.com`;
    await api()
      .post('/api/auth/register')
      .send({ email, password: strongPassword, name: `${role} 테스터`, role })
      .expect(201);

    const link = verificationLinksByEmail.get(email);
    expect(link).toBeDefined();
    await api()
      .post('/api/auth/verify-email')
      .send({ token: extractToken(link!) })
      .expect(201);

    const loginRes = await api().post('/api/auth/login').send({ email, password: strongPassword }).expect(201);
    return { email, userId: loginRes.body.user.id, token: loginRes.body.accessToken };
  }

  const DOMAIN = DomainType.BACKEND_DB_TUNING;
  const BOUNTY_AMOUNT = 200000;

  let client: { email: string; userId: string; token: string };
  let expert: { email: string; userId: string; token: string };
  let unrelatedUser: { email: string; userId: string; token: string };
  let bountyId: string;
  let applicationId: string;

  it('의뢰인/전문가/제3자 계정을 각각 가입 + 이메일 인증까지 완료한다', async () => {
    client = await registerVerifiedUser(UserRole.CLIENT);
    expert = await registerVerifiedUser(UserRole.EXPERT);
    unrelatedUser = await registerVerifiedUser(UserRole.CLIENT);

    expect(client.token).toEqual(expect.any(String));
    expect(expert.token).toEqual(expect.any(String));
    expect(unrelatedUser.token).toEqual(expect.any(String));
  });

  it('전문가가 해당 도메인 자격 인증을 신청하면 (증빙서류 없이도) 형식 검증만으로 자동 승인된다', async () => {
    const res = await api()
      .post('/api/certifications')
      .set('Authorization', `Bearer ${expert.token}`)
      .field('domainType', DOMAIN)
      .field('track', VerificationTrack.STANDARD)
      .field('licenseNumber', 'BACKEND-LICENSE-0001')
      .expect(201);

    expect(res.body.verifiedStatus).toBe('APPROVED');
  });

  it('자격 인증이 없으면 지원 자체가 403으로 막힌다 (제3자 계정으로 확인)', async () => {
    const bountyRes = await api()
      .post('/api/bounties')
      .set('Authorization', `Bearer ${client.token}`)
      .send({
        domainType: DOMAIN,
        title: '자격 미보유 지원 차단 테스트용 임시 바운티',
        description: '이 바운티는 자격 인증 없는 사용자의 지원이 막히는지 확인하기 위한 임시 데이터입니다.',
        bountyAmount: 50000,
      })
      .expect(201);

    // unrelatedUser는 CLIENT로 가입했고 어떤 도메인 인증도 받지 않았다 -
    // apply()는 역할(role)이 아니라 "승인된 자격 인증이 있는가"만 보므로 그대로 막혀야 한다.
    await api()
      .post(`/api/bounties/${bountyRes.body.id}/apply`)
      .set('Authorization', `Bearer ${unrelatedUser.token}`)
      .send({})
      .expect(403);
  });

  it('의뢰인이 바운티를 등록한다', async () => {
    const res = await api()
      .post('/api/bounties')
      .set('Authorization', `Bearer ${client.token}`)
      .send({
        domainType: DOMAIN,
        title: 'E2E 테스트용 백엔드 쿼리 튜닝 바운티',
        description: '실제 운영 중인 서비스의 느린 쿼리를 진단하고 개선해주실 전문가를 찾습니다. (e2e 테스트 데이터)',
        bountyAmount: BOUNTY_AMOUNT,
      })
      .expect(201);

    expect(res.body.status).toBe('PENDING');
    expect(res.body.clientId).toBe(client.userId);
    bountyId = res.body.id;
  });

  it('자격을 갖춘 전문가는 바운티에 지원할 수 있다', async () => {
    const res = await api()
      .post(`/api/bounties/${bountyId}/apply`)
      .set('Authorization', `Bearer ${expert.token}`)
      .send({ message: '해당 분야 3년 경력 있습니다.' })
      .expect(201);

    expect(res.body.status).toBe('APPLIED');
    applicationId = res.body.id;
  });

  it('바운티를 등록한 의뢰인이 아니면 지원자를 선택할 수 없다 (403)', async () => {
    await api()
      .post(`/api/bounties/${bountyId}/select/${applicationId}`)
      .set('Authorization', `Bearer ${unrelatedUser.token}`)
      .expect(403);
  });

  let paymentAmount: number;

  it('의뢰인이 지원자를 선택하면 PAYMENT_PENDING으로 전환되고 결제 정보가 발급된다', async () => {
    const res = await api()
      .post(`/api/bounties/${bountyId}/select/${applicationId}`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(201);

    expect(res.body.paymentId).toEqual(expect.any(String));
    // amount는 DB의 bigint 컬럼이라 TypeORM/pg가 JS number 정밀도 손실을 피하려고
    // 문자열로 내려준다 (transactions.service.ts의 settleMilestone 주석과 동일한 이유) -
    // 그래서 비교 전에 Number()로 변환한다.
    expect(Number(res.body.amount)).toBe(BOUNTY_AMOUNT);
    expect(res.body.bounty.status).toBe('PAYMENT_PENDING');
    paymentAmount = Number(res.body.amount);
  });

  it('결제 확인 후 에스크로가 LOCKED 상태로 전환된다 (Mock PG는 항상 결제 성공 처리)', async () => {
    const res = await api()
      .post(`/api/bounties/${bountyId}/confirm-payment`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(201);

    expect(res.body.status).toBe('LOCKED');
  });

  it('선택되지 않은(=아무 관계 없는) 사용자는 결과물을 제출할 수 없다 (403)', async () => {
    // [발견] submitResult 컨트롤러는 "파일 첨부 여부"를 서비스 레이어의 권한 검사보다
    // 먼저 확인한다 (bounties.controller.ts: `if (!file) throw new BadRequestException`
    // 이 bountiesService.submitResult() 호출보다 앞줄에 있음) - 그래서 파일 없이
    // 권한만 검증하려 하면 403이 아니라 400(파일 없음)이 먼저 떨어진다. 실제 권한 검사
    // 로직(BountiesService.submitResult의 assignedExpertId 비교)까지 도달시키려면
    // 여기서도 유효한 파일을 함께 보내야 한다. (민감정보 노출은 없는 사소한 순서
    // 이슈라 보안 문제는 아니지만, 프론트가 "왜 403이 아니라 400이 오지?"라고 헷갈릴
    // 여지는 있어 PROGRESS.md에 개선 아이디어로 남겨둔다.)
    const zipBuffer = Buffer.from('504b0304140000000000', 'hex');
    await api()
      .post(`/api/bounties/${bountyId}/submit`)
      .set('Authorization', `Bearer ${unrelatedUser.token}`)
      .field('note', '권한 없는 제출 시도')
      .attach('resultFile', zipBuffer, 'result.zip')
      .expect(403);
  });

  it('선택된 전문가가 결과물(zip)을 제출하면 SUBMITTED 상태로 전환된다', async () => {
    // 매직바이트가 실제 zip 로컬 파일 헤더(PK\x03\x04)와 일치하는 최소 버퍼 -
    // file-validation.util의 매직바이트 검증까지 실제로 통과해야 한다.
    const zipBuffer = Buffer.from('504b0304140000000000', 'hex');

    const res = await api()
      .post(`/api/bounties/${bountyId}/submit`)
      .set('Authorization', `Bearer ${expert.token}`)
      .field('note', 'N+1 쿼리 3건 개선, 인덱스 2개 추가 완료했습니다.')
      .attach('resultFile', zipBuffer, 'result.zip')
      .expect(201);

    expect(res.body.status).toBe('SUBMITTED');
  });

  it('바운티를 등록한 의뢰인이 아니면 결과물을 승인할 수 없다 (403)', async () => {
    await api()
      .post(`/api/bounties/${bountyId}/approve`)
      .set('Authorization', `Bearer ${unrelatedUser.token}`)
      .expect(403);
  });

  it('의뢰인이 승인하면 SETTLED로 전환되고, 플랫폼 수수료(10%)가 정확히 계산되어 정산된다', async () => {
    const res = await api()
      .post(`/api/bounties/${bountyId}/approve`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(201);

    expect(res.body.status).toBe('SETTLED');

    const txRes = await api()
      .get(`/api/transactions/by-bounty/${bountyId}`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);

    const expectedFee = Math.floor(paymentAmount * 0.1);
    expect(txRes.body.escrowStatus).toBe('SETTLED');
    expect(Number(txRes.body.platformFeeAmount)).toBe(expectedFee);
    expect(Number(txRes.body.settledAmount)).toBe(paymentAmount);
  });

  it('이미 정산이 끝난 바운티는 다시 승인할 수 없다 (400)', async () => {
    await api()
      .post(`/api/bounties/${bountyId}/approve`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(400);
  });
});
