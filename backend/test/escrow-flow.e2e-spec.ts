import * as request from 'supertest';
import * as crypto from 'crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import { createTestApp, randomSuffix, captureMailTokens } from './utils/test-app';

/**
 * e2e — 에스크로 거래 흐름 (3/5)
 * 바운티 등록 → 지원 → 선택(LOCKED) → 제출(SUBMITTED) → 승인(SETTLED) 전 구간을
 * 실제 DB/HTTP 요청으로 끝까지 연결해 검증한다. 비정상 흐름(권한 없는 승인 시도,
 * 상태를 건너뛴 승인 시도)도 함께 확인한다.
 */
describe('에스크로 거래 흐름 (e2e)', () => {
  let app: NestExpressApplication;
  let http: any;
  let mail: ReturnType<typeof captureMailTokens>;

  const password = 'Str0ng!Passw0rd#2026';

  async function registerVerifiedLogin(role: 'CLIENT' | 'EXPERT') {
    const email = `escrow_${role.toLowerCase()}_${randomSuffix()}@e2e.test`;
    await request(http).post('/api/auth/register').send({ email, password, name: '테스터', role }).expect(201);
    const token = mail.verificationTokens[email];
    await request(http).post('/api/auth/verify-email/confirm').send({ token }).expect(204);
    const loginRes = await request(http).post('/api/auth/login').send({ email, password }).expect(201);
    return { email, accessToken: loginRes.body.accessToken as string };
  }

  function findApprovedLicenseNumber(prefix: string): string {
    for (let i = 0; i < 3000; i++) {
      const candidate = `${prefix}-${i}`;
      const hash = crypto.createHash('sha256').update(candidate).digest('hex');
      const bucket = parseInt(hash.slice(0, 8), 16) % 100;
      if (bucket < 85) return candidate;
    }
    throw new Error('approved license number를 찾지 못함');
  }

  async function createLockedBounty() {
    const client = await registerVerifiedLogin('CLIENT');
    const expert = await registerVerifiedLogin('EXPERT');
    const licenseNumber = findApprovedLicenseNumber('LIC-ESC');

    await request(http)
      .post('/api/certifications')
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .send({ domainType: 'DEV_CODE_REVIEW', track: 'STANDARD', licenseNumber })
      .expect(201);

    const bountyRes = await request(http)
      .post('/api/bounties')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({
        domainType: 'DEV_CODE_REVIEW',
        title: '에스크로 거래 흐름 e2e 테스트',
        description: '등록→지원→선택→제출→승인 전 구간을 검증하는 시나리오입니다',
        bountyAmount: 50000,
      })
      .expect(201);
    const bountyId = bountyRes.body.id;

    await request(http)
      .post(`/api/bounties/${bountyId}/apply`)
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .send({ message: '지원합니다' })
      .expect(201);

    const applicantsRes = await request(http)
      .get(`/api/bounties/${bountyId}/applicants`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);
    const applicationId = applicantsRes.body[0].id;

    const selectRes = await request(http)
      .post(`/api/bounties/${bountyId}/select/${applicationId}`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(201);

    return { client, expert, bountyId, selectStatus: selectRes.body.status };
  }

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    mail = captureMailTokens(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('바운티 등록→지원→선택 직후 상태는 LOCKED로 전이한다', async () => {
    const { selectStatus } = await createLockedBounty();
    expect(selectStatus).toBe('LOCKED');
  });

  it('LOCKED 상태에서 곧바로 승인(approve)을 시도하면 거부된다 (SUBMITTED를 건너뛸 수 없다)', async () => {
    const { client, bountyId } = await createLockedBounty();
    await request(http)
      .post(`/api/bounties/${bountyId}/approve`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(400);
  });

  it('전문가가 결과물을 제출하면 SUBMITTED 상태가 되고, 의뢰인이 승인하면 SETTLED로 정산 완료된다', async () => {
    const { client, expert, bountyId } = await createLockedBounty();

    // 유효한 ZIP 매직바이트(PK\x03\x04)를 가진 결과 파일을 첨부해서 제출
    const zipBuffer = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('dummy zip content')]);
    await request(http)
      .post(`/api/bounties/${bountyId}/submit`)
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .field('note', '작업을 완료했습니다')
      .attach('resultFile', zipBuffer, 'result.zip')
      .expect(201);

    const afterSubmit = await request(http)
      .get(`/api/bounties/${bountyId}`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);
    expect(afterSubmit.body.status).toBe('SUBMITTED');

    await request(http)
      .post(`/api/bounties/${bountyId}/approve`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(201);

    const afterApprove = await request(http)
      .get(`/api/bounties/${bountyId}`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);
    expect(afterApprove.body.status).toBe('SETTLED');

    const txRes = await request(http)
      .get(`/api/transactions/by-bounty/${bountyId}`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);
    expect(txRes.body.escrowStatus).toBe('SETTLED');
    expect(Number(txRes.body.platformFeeAmount)).toBe(5000); // 50000원의 10%
  });

  it('이 바운티의 의뢰인이 아닌 제3자가 지원자를 선택하려 하면 거부된다', async () => {
    const client = await registerVerifiedLogin('CLIENT');
    const outsider = await registerVerifiedLogin('CLIENT');
    const expert = await registerVerifiedLogin('EXPERT');
    const licenseNumber = findApprovedLicenseNumber('LIC-OUT');

    await request(http)
      .post('/api/certifications')
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .send({ domainType: 'DEV_CODE_REVIEW', track: 'STANDARD', licenseNumber })
      .expect(201);

    const bountyRes = await request(http)
      .post('/api/bounties')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({
        domainType: 'DEV_CODE_REVIEW',
        title: '제3자 권한 검증 테스트',
        description: '바운티 소유자가 아닌 사람이 선택을 시도하는 시나리오입니다',
        bountyAmount: 30000,
      })
      .expect(201);
    const bountyId = bountyRes.body.id;

    await request(http)
      .post(`/api/bounties/${bountyId}/apply`)
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .send({ message: '지원합니다' })
      .expect(201);
    const applicantsRes = await request(http)
      .get(`/api/bounties/${bountyId}/applicants`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);
    const applicationId = applicantsRes.body[0].id;

    await request(http)
      .post(`/api/bounties/${bountyId}/select/${applicationId}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(403);
  });
});
