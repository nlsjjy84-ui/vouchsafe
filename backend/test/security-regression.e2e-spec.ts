import * as request from 'supertest';
import { NestExpressApplication } from '@nestjs/platform-express';
import { createTestApp, randomSuffix, captureMailTokens } from './utils/test-app';

/**
 * e2e — 보안 회귀 테스트 (4/5)
 * 사례 연구에서 나온 각 보안 이슈(로그아웃 세션 무효화, 업로드 매직바이트/용량 위반,
 * 이메일 인증 게이트, 약한 비밀번호)마다 회귀가 생기지 않는지 실제 요청으로 재확인한다.
 */
describe('보안 회귀 테스트 (e2e)', () => {
  let app: NestExpressApplication;
  let http: any;
  let mail: ReturnType<typeof captureMailTokens>;

  const password = 'Str0ng!Passw0rd#2026';

  async function registerVerifiedLogin() {
    const email = `secreg_${randomSuffix()}@e2e.test`;
    await request(http).post('/api/auth/register').send({ email, password, name: '테스터', role: 'EXPERT' }).expect(201);
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

  it('전체 로그아웃(logout-all)을 하면 같은 계정의 다른 세션 토큰도 함께 무효화된다', async () => {
    const email = `secreg_${randomSuffix()}@e2e.test`;
    await request(http).post('/api/auth/register').send({ email, password, name: '테스터', role: 'CLIENT' }).expect(201);
    const token = mail.verificationTokens[email];
    await request(http).post('/api/auth/verify-email/confirm').send({ token }).expect(204);

    const sessionA = (await request(http).post('/api/auth/login').send({ email, password }).expect(201)).body
      .accessToken;
    const sessionB = (await request(http).post('/api/auth/login').send({ email, password }).expect(201)).body
      .accessToken;

    await request(http).get('/api/auth/me').set('Authorization', `Bearer ${sessionA}`).expect(200);
    await request(http).get('/api/auth/me').set('Authorization', `Bearer ${sessionB}`).expect(200);

    await request(http).post('/api/auth/logout-all').set('Authorization', `Bearer ${sessionA}`).expect(204);

    await request(http).get('/api/auth/me').set('Authorization', `Bearer ${sessionA}`).expect(401);
    await request(http).get('/api/auth/me').set('Authorization', `Bearer ${sessionB}`).expect(401);
  });

  it('서명(signature)이 유효한 JWT라도 로그아웃으로 revoke된 세션이면 다른 보호된 API에서도 거부된다', async () => {
    const user = await registerVerifiedLogin();
    await request(http)
      .get('/api/certifications/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);

    await request(http).post('/api/auth/logout').set('Authorization', `Bearer ${user.accessToken}`).expect(204);

    await request(http)
      .get('/api/certifications/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(401);
  });

  it('확장자를 위장한 파일(텍스트를 .png로) 업로드는 매직바이트 검증에서 400으로 거부된다', async () => {
    const user = await registerVerifiedLogin();
    const fakeBuffer = Buffer.from('this is plain text pretending to be a png file');

    const res = await request(http)
      .post('/api/certifications')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .field('domainType', 'DEV_CODE_REVIEW')
      .field('track', 'STANDARD')
      .field('licenseNumber', `SECREG-${randomSuffix()}`)
      .attach('evidenceFile', fakeBuffer, 'evidence.png')
      .expect(400);
    expect(res.body.message).toContain('위장');
  });

  it('증빙 파일 상한(15MB)을 넘는 파일은 stream 단계에서 즉시 413으로 거부된다', async () => {
    const user = await registerVerifiedLogin();
    // 유효한 PNG 시그니처로 시작하되 16MB로 부풀린 버퍼 — 시그니처 검사까지 갈 필요도 없이
    // multer의 limits.fileSize에서 먼저 걸려야 한다.
    const oversized = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(16 * 1024 * 1024, 0),
    ]);

    await request(http)
      .post('/api/certifications')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .field('domainType', 'DEV_CODE_REVIEW')
      .field('track', 'STANDARD')
      .field('licenseNumber', `SECREG-BIG-${randomSuffix()}`)
      .attach('evidenceFile', oversized, 'evidence.png')
      .expect(413);
  });

  it('16자 미만이거나 특수문자가 없는 비밀번호로는 회원가입 자체가 400으로 거부된다', async () => {
    const email = `secreg_weak_${randomSuffix()}@e2e.test`;
    await request(http)
      .post('/api/auth/register')
      .send({ email, password: 'tooshort1!', name: '테스터', role: 'CLIENT' })
      .expect(400);
    await request(http)
      .post('/api/auth/register')
      .send({ email, password: 'NoSpecialCharPassword1', name: '테스터', role: 'CLIENT' })
      .expect(400);
  });

  it('아이디/비밀번호가 틀렸을 때와 미인증 계정일 때의 메시지가 서로 명확히 구분된다 (enumeration 방지 + 식별 가능한 코드)', async () => {
    const wrongCredsRes = await request(http)
      .post('/api/auth/login')
      .send({ email: 'nonexistent-user@e2e.test', password: 'Wr0ngPassw0rd!#2026' })
      .expect(401);
    expect(wrongCredsRes.body.errorCode).toBeUndefined();

    const email = `secreg_unverified_${randomSuffix()}@e2e.test`;
    await request(http).post('/api/auth/register').send({ email, password, name: '테스터', role: 'CLIENT' }).expect(201);
    const unverifiedRes = await request(http).post('/api/auth/login').send({ email, password }).expect(403);
    expect(unverifiedRes.body.errorCode).toBe('EMAIL_NOT_VERIFIED');
  });
});
