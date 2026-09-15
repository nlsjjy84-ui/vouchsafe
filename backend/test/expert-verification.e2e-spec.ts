import * as request from 'supertest';
import { NestExpressApplication } from '@nestjs/platform-express';
import { createTestApp, randomSuffix, captureMailTokens } from './utils/test-app';

/**
 * e2e — 전문가 검증 흐름 (2/5)
 * 인증 신청 → Mock 승인/반려 → "승인 후에만 해당 도메인 바운티에 지원 가능한지"
 * 경계 조건까지 실제 DB/HTTP로 확인한다.
 */
describe('전문가 검증 흐름 (e2e)', () => {
  let app: NestExpressApplication;
  let http: any;
  let mail: ReturnType<typeof captureMailTokens>;

  const password = 'Str0ng!Passw0rd#2026';

  async function registerVerifiedLogin(role: 'CLIENT' | 'EXPERT') {
    const email = `expver_${role.toLowerCase()}_${randomSuffix()}@e2e.test`;
    await request(http).post('/api/auth/register').send({ email, password, name: '테스터', role }).expect(201);
    const token = mail.verificationTokens[email];
    await request(http).post('/api/auth/verify-email/confirm').send({ token }).expect(204);
    const loginRes = await request(http).post('/api/auth/login').send({ email, password }).expect(201);
    return { email, accessToken: loginRes.body.accessToken as string };
  }

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    mail = captureMailTokens(app);
  });

  afterAll(async () => {
    await app.close();
  });

  // 결정론적 mock OCR 시드로 "확실히 APPROVED가 나오는" licenseNumber를 미리 찾아둔다
  // (src/mocks/mock-verification.service.ts의 seededBucket과 동일한 SHA-256 규칙).
  function findApprovedLicenseNumber(): string {
    const crypto = require('crypto');
    for (let i = 0; i < 3000; i++) {
      const candidate = `LIC-EXP-${i}`;
      const hash = crypto.createHash('sha256').update(candidate).digest('hex');
      const bucket = parseInt(hash.slice(0, 8), 16) % 100;
      if (bucket < 85) return candidate;
    }
    throw new Error('approved license number를 찾지 못함');
  }

  it('전문가가 승인되지 않은 상태에서 해당 도메인 바운티에 지원하면 403으로 거부된다', async () => {
    const client = await registerVerifiedLogin('CLIENT');
    const expert = await registerVerifiedLogin('EXPERT');

    const bountyRes = await request(http)
      .post('/api/bounties')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({
        domainType: 'DEV_CODE_REVIEW',
        title: '전문가 검증 흐름 테스트용 바운티',
        description: '아직 승인받지 못한 전문가가 지원을 시도하는 시나리오입니다',
        bountyAmount: 20000,
      })
      .expect(201);

    await request(http)
      .post(`/api/bounties/${bountyRes.body.id}/apply`)
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .send({ message: '지원합니다' })
      .expect(403);
  });

  it('자격 인증을 신청하면 Mock 판정 결과(APPROVED/REJECTED/PENDING)가 즉시 저장된다', async () => {
    const expert = await registerVerifiedLogin('EXPERT');
    const licenseNumber = findApprovedLicenseNumber();

    const res = await request(http)
      .post('/api/certifications')
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .send({ domainType: 'DEV_CODE_REVIEW', track: 'STANDARD', licenseNumber })
      .expect(201);
    expect(res.body.verifiedStatus).toBe('APPROVED');
  });

  it('승인된 자격을 가진 전문가는 같은 도메인 바운티에 지원할 수 있다 (경계조건: 승인 후에만 허용)', async () => {
    const client = await registerVerifiedLogin('CLIENT');
    const expert = await registerVerifiedLogin('EXPERT');
    const licenseNumber = findApprovedLicenseNumber();

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
        title: '승인된 전문가 지원 테스트',
        description: '승인 완료 후 지원이 정상적으로 허용되는지 확인하는 시나리오입니다',
        bountyAmount: 25000,
      })
      .expect(201);

    await request(http)
      .post(`/api/bounties/${bountyRes.body.id}/apply`)
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .send({ message: '지원합니다' })
      .expect(201);
  });

  it('한 도메인에서 승인받았어도 다른 도메인 바운티에는 지원할 수 없다 (도메인 경계 검사)', async () => {
    const client = await registerVerifiedLogin('CLIENT');
    const expert = await registerVerifiedLogin('EXPERT');
    const licenseNumber = findApprovedLicenseNumber();

    // DEV_CODE_REVIEW 도메인만 승인받음
    await request(http)
      .post('/api/certifications')
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .send({ domainType: 'DEV_CODE_REVIEW', track: 'STANDARD', licenseNumber })
      .expect(201);

    // 승인받지 않은 다른 도메인(VEHICLE_DIAGNOSTICS) 바운티에는 여전히 거부되어야 한다
    const bountyRes = await request(http)
      .post('/api/bounties')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({
        domainType: 'VEHICLE_DIAGNOSTICS',
        title: '다른 도메인 바운티',
        description: '전문가가 승인받지 않은 도메인에 지원을 시도하는 시나리오입니다',
        bountyAmount: 25000,
      })
      .expect(201);

    await request(http)
      .post(`/api/bounties/${bountyRes.body.id}/apply`)
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .send({ message: '지원합니다' })
      .expect(403);
  });
});
