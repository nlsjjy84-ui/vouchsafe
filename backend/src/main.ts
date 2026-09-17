// 반드시 가장 먼저 로드한다: 아래 getJwtSecretOrThrow()가 NestFactory.create()보다도 먼저
// process.env.JWT_SECRET을 검사하는데, .env 파일을 실제로 process.env에 읽어들이는 건
// 원래 AppModule 안의 ConfigModule.forRoot()가 하는 일이라 NestFactory.create() 시점에야
// 일어난다. 즉 이 줄이 없으면 .env에 JWT_SECRET이 멀쩡히 적혀 있어도 그보다 먼저 실행되는
// getJwtSecretOrThrow()엔 항상 "설정 안 됨"으로 보여 매번 fail-fast가 발동해버린다
// (테스트/CI에서는 항상 셸 환경변수로 JWT_SECRET을 미리 주입했기 때문에 이 버그가
// 가려져 있었다 — 로컬에서 .env 파일만 믿고 npm run start:dev로 띄울 때만 드러난다).
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { getJwtSecretOrThrow } from './config/jwt-secret';

/**
 * 진행상황: Phase 1 - 서버 부트스트랩 / Phase 2 - 전역 예외 처리 + Swagger 문서화
 * - 프론트(Vite, 5173) ↔ 백엔드(8080) 분리 배포를 전제로 CORS를 열어둔다.
 * - ValidationPipe: 컨트롤러에 들어오는 모든 DTO에 대해 class-validator 검증을 자동 적용.
 *   whitelist: DTO에 없는 필드는 자동으로 걸러내 예상치 못한 값 주입을 막는다.
 * - AllExceptionsFilter: 처리되지 않은 예외(DB 에러 포함)가 스택 트레이스째로 응답에
 *   노출되는 걸 막고, Postgres 22P02(잘못된 형식) 같은 케이스는 400으로 정확히 변환한다.
 * - Swagger: /api/docs 에서 전체 API를 한눈에 보고 JWT 토큰으로 직접 호출까지 해볼 수 있다.
 * - rawBody: true — 웹훅 서명 검증(WebhooksController)은 파싱된 JSON이 아니라 원문 바이트로
 *   HMAC을 계산해야 해서, Nest가 body-parser 단계에서 원문을 req.rawBody에 함께 보존하게 한다.
 */
async function bootstrap() {
  // Security 1탄: "JWT_SECRET 하드코딩 폴백 제거(fail-fast)".
  // NestFactory.create()가 모듈 트리를 조립하는 도중(JwtModule/JwtStrategy)에 실패하면
  // 스택 트레이스가 뒤섞인 채로 죽는다 — 그 전에 여기서 먼저 검사해 원인을 한 줄로 명확히
  // 알려주고 즉시 종료한다. 운영 배포 시 이 환경변수를 빠뜨렸다면 서버가 "일단 뜨는" 대신
  // 바로 죽어야 한다(안전하지 않은 기본값으로 조용히 뜨는 게 훨씬 위험하다).
  try {
    getJwtSecretOrThrow();
  } catch (err) {
    console.error(`[FATAL] ${(err as Error).message}`);
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Security 1탄: helmet — Content-Security-Policy, X-Frame-Options, HSTS 등
  // 기본적인 보안 HTTP 헤더 세트를 한 번에 적용한다.
  app.use(helmet());

  // Mock S3 대체 - 로컬 uploads 폴더를 정적 파일로 서빙 (증빙/결과물 미리보기용)
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN?.split(',') ?? ['http://localhost:5173'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('CredoBounty API')
    .setDescription(
      '검증된 전문가와 의뢰인을 잇는 에스크로 거래 플랫폼 API 문서. ' +
        '인증이 필요한 요청은 우측 상단 Authorize 버튼에 로그인으로 발급받은 JWT를 입력하세요.',
    )
    .setVersion('0.2.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT-auth', // @ApiBearerAuth('JWT-auth')와 짝을 맞추는 식별자
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 8080;
  await app.listen(port);
  console.log(`CredoBounty API running on http://localhost:${port}/api`);
  console.log(`Swagger docs on http://localhost:${port}/api/docs`);
}
bootstrap();
