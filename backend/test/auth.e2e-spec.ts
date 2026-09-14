import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { MockEmailService } from '../src/mocks/mock-email.service';
import { UserRole } from '../src/common/enums/user-role.enum';

/**
 * =========================================================================
 * auth.e2e-spec.ts — 실제 테스트 DB(credobounty_test)에 대고 HTTP 요청까지
 * 실제로 보내면서 인증 흐름 전체를 검증한다.
 * =========================================================================
 * AuthService는 순수 유닛테스트(auth.service.spec.ts)로도 커버했지만, 여기서는
 * "회원가입 → (이메일 미인증) 로그인 차단 → 인증 → 로그인 → 내 정보 조회 →
 * 로그아웃 → 무효화된 토큰 재사용 차단 → 비밀번호 재설정 시 전체 세션 revoke"까지
 * 이어지는 실제 흐름을, 실제 ValidationPipe/AllExceptionsFilter/JwtStrategy/
 * ThrottlerGuard가 전부 켜진 상태에서 진짜 DB에 값이 남는지까지 확인한다.
 *
 * MockEmailService는 실제로 메일을 보내지 않고 콘솔에 로그만 남기므로
 * (mock-email.service.ts 참고), 그 안의 링크에서 토큰을 꺼내기 위해
 * overrideProvider로 "보낸 링크를 배열에 저장해두는" 가짜 구현으로 바꿔치기한다.
 * 이메일 서버 없이도 실제 발급된 토큰 값 그대로 인증/재설정 흐름을 이어갈 수 있다.
 * =========================================================================
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let sentVerificationLinks: string[] = [];
  let sentResetLinks: string[] = [];

  const fakeMockEmail = {
    sendVerificationEmail: (_email: string, link: string) => {
      sentVerificationLinks.push(link);
    },
    sendPasswordResetEmail: (_email: string, link: string) => {
      sentResetLinks.push(link);
    },
  };

  const extractToken = (link: string): string => new URL(link).searchParams.get('token') as string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MockEmailService)
      .useValue(fakeMockEmail)
      .compile();

    app = moduleRef.createNestApplication();
    // main.ts 부트스트랩과 동일한 전역 설정을 맞춰줘야, 실제 서비스에서 벌어지는
    // 것과 똑같은 검증/에러응답 형태로 테스트할 수 있다.
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const email = `e2e-auth-${randomUUID()}@example.com`;
  const password = 'InitialStrongPassw0rd!!';
  const newPassword = 'RotatedStrongPassw0rd!!';

  it('POST /auth/register - 가입 성공 시 accessToken 없이 안내 메시지만 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password, name: 'E2E 테스터', role: UserRole.CLIENT })
      .expect(201);

    expect(res.body).not.toHaveProperty('accessToken');
    expect(res.body.email).toBe(email);
    expect(sentVerificationLinks.length).toBe(1);
  });

  it('POST /auth/register - 동일 이메일 재가입은 409 Conflict', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password, name: '중복', role: UserRole.CLIENT })
      .expect(409);
  });

  it('POST /auth/login - 이메일 인증 전이면 403 + EMAIL_NOT_VERIFIED', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(403);

    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
  });

  it('POST /auth/verify-email - 발급된 토큰으로 인증을 완료한다', async () => {
    const token = extractToken(sentVerificationLinks[0]);
    await request(app.getHttpServer()).post('/api/auth/verify-email').send({ token }).expect(201);
  });

  let accessToken: string;

  it('POST /auth/login - 인증 완료 후에는 로그인이 성공하고 accessToken을 받는다', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe(email);
    accessToken = res.body.accessToken;
  });

  it('GET /auth/me - 유효한 토큰이면 내 정보를 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.email).toBe(email);
  });

  it('GET /auth/me - 토큰 없이는 401', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('POST /auth/logout - 로그아웃 후 같은 토큰 재사용은 401 (서버측 세션 무효화 확인)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });

  let secondSessionToken: string;

  it('비밀번호 재설정 시, 그 전에 발급된 모든 세션이 강제로 revoke된다', async () => {
    // 새로 로그인해서 "재설정 전에 살아있던 세션"을 하나 만들어둔다.
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);
    secondSessionToken = loginRes.body.accessToken;

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${secondSessionToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email })
      .expect(201);
    expect(sentResetLinks.length).toBe(1);

    const resetToken = extractToken(sentResetLinks[0]);
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token: resetToken, newPassword })
      .expect(201);

    // 비밀번호를 바꾸기 전에 발급되어 있던 세션은 이제 무효화되어야 한다.
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${secondSessionToken}`)
      .expect(401);
  });

  it('새 비밀번호로는 로그인이 성공하고, 옛 비밀번호로는 실패한다', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(401);

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: newPassword })
      .expect(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('POST /auth/register - 약한 비밀번호(정책 미달)는 400으로 거부된다', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: `e2e-weak-${randomUUID()}@example.com`, password: 'short1!', name: '약함', role: UserRole.CLIENT })
      .expect(400);
  });
});
