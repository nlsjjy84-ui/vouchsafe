import * as request from 'supertest';
import { NestExpressApplication } from '@nestjs/platform-express';
import { createTestApp, randomSuffix, captureMailTokens } from './utils/test-app';

/**
 * e2e — 인증 흐름 (1/5)
 * 회원가입 → 이메일 인증 → 로그인 → 미인증 로그인 차단(403) → 로그아웃 후 세션 무효화
 * 까지 전 구간을 실제 DB에 대고 HTTP 요청으로 끝까지 흘려보내며 검증한다.
 */
describe('인증 흐름 (e2e)', () => {
  let app: NestExpressApplication;
  let http: any;
  let mail: ReturnType<typeof captureMailTokens>;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    mail = captureMailTokens(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const email = `auth_${randomSuffix()}@e2e.test`;
  const password = 'Str0ng!Passw0rd#2026';

  it('회원가입은 성공하지만 accessToken을 함께 내려주지 않는다 (자동 로그인 제거)', async () => {
    const res = await request(http)
      .post('/api/auth/register')
      .send({ email, password, name: 'E2E테스터', role: 'CLIENT' })
      .expect(201);
    expect(res.body.email).toBe(email);
    expect(res.body.accessToken).toBeUndefined();
    expect(mail.verificationTokens[email]).toBeDefined();
  });

  it('이메일 인증을 마치기 전에는 비밀번호가 맞아도 로그인이 403(EMAIL_NOT_VERIFIED)으로 막힌다', async () => {
    const res = await request(http)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(403);
    expect(res.body.errorCode).toBe('EMAIL_NOT_VERIFIED');
  });

  it('발급된 인증 토큰으로 이메일 인증을 확정하면 204를 받는다', async () => {
    const token = mail.verificationTokens[email];
    await request(http).post('/api/auth/verify-email/confirm').send({ token }).expect(204);
  });

  it('이메일 인증 후에는 정상적으로 로그인되어 accessToken을 받는다', async () => {
    const res = await request(http)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(email);
  });

  it('로그아웃 후에는 같은 토큰으로 보호된 엔드포인트에 접근하면 401이 된다 (서버측 세션 revoke)', async () => {
    const loginRes = await request(http).post('/api/auth/login').send({ email, password }).expect(201);
    const token = loginRes.body.accessToken;

    await request(http)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(http).post('/api/auth/logout').set('Authorization', `Bearer ${token}`).expect(204);

    const afterLogout = await request(http)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    expect(afterLogout.body.message).toContain('로그아웃');
  });
});
