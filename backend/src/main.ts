import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * 진행상황: Phase 1 - 서버 부트스트랩 / Phase 2 - 전역 예외 필터 추가
 * - 프론트(Next.js, 3000) ↔ 백엔드(8080) 분리 배포를 전제로 CORS를 열어둔다.
 *   (개발 중에는 next.config.js의 rewrites가 프록시해줘서 브라우저는 이 CORS 설정을
 *   거의 안 타지만, 배포 후 프론트/백엔드 도메인이 완전히 갈라지면 이 설정이 필요해진다)
 * - ValidationPipe: 컨트롤러에 들어오는 모든 DTO에 대해 class-validator 검증을 자동 적용.
 *   whitelist: DTO에 없는 필드는 자동으로 걸러내 예상치 못한 값 주입을 막는다.
 * - AllExceptionsFilter: 위 두 가지로도 못 막는 "예상치 못한" 에러까지 전부 받아서
 *   일관된 형태로 응답하는 최종 안전망 (common/filters/all-exceptions.filter.ts 참고)
 */
async function bootstrap() {
  // rawBody: true - Task #29 포트원 웹훅 서명 검증에 필요. express의 body-parser가
  // JSON으로 파싱하기 전의 원본 바이트를 req.rawBody에 그대로 남겨준다. 서명은
  // "가공 전 원문 문자열" 기준으로 계산되므로, 파싱 후 JSON을 다시 문자열화하면
  // (키 순서/공백 차이 등으로) 서명이 깨진다 - webhooks.controller.ts 참고.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  app.useGlobalFilters(new AllExceptionsFilter());

  // [보안 강화] helmet: X-Content-Type-Options, X-Frame-Options(클릭재킹 방지),
  // Strict-Transport-Security 등 기본적인 보안 헤더를 자동으로 붙여준다.
  // contentSecurityPolicy만 꺼둔 이유: 이 서버가 /api-docs(Swagger UI)도 같이
  // 서빙하는데, Swagger UI는 인라인 스크립트/스타일을 쓰기 때문에 helmet의
  // 기본 CSP를 그대로 켜면 Swagger 화면 자체가 깨진다. 이 프로젝트는 실제
  // 사용자 화면(HTML)을 이 서버가 직접 서빙하지 않고(프론트는 별도 Next.js
  // 서버) API + 개발용 문서 페이지만 내려주므로, CSP 없이도 다른 헤더들만으로
  // 실질적인 방어 효과는 충분하다고 판단했다.
  app.use(helmet({ contentSecurityPolicy: false }));

  // Mock S3 대체 - 로컬 uploads 폴더를 정적 파일로 서빙 (증빙/결과물 미리보기용)
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  // Task #28 "Swagger/OpenAPI 문서 자동화": 컨트롤러/DTO에 붙인 데코레이터를 읽어서
  // API 문서를 자동 생성 + 브라우저에서 바로 "Try it out"으로 호출까지 해볼 수 있는
  // 화면을 제공한다. setGlobalPrefix('api') 뒤에 등록해야 문서 자체 경로는 /api-docs로
  // 깔끔하게 분리된다 (안 그러면 /api/api-docs가 되어버림).
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CredoBounty API')
    .setDescription(
      '검증된 전문가-의뢰인 에스크로 거래 플랫폼 CredoBounty의 백엔드 API 문서입니다. ' +
        '오른쪽 위 "Authorize" 버튼에 로그인으로 발급받은 JWT를 넣으면 인증이 필요한 ' +
        'API도 이 화면에서 바로 호출해볼 수 있습니다.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, swaggerDocument);

  const port = process.env.PORT ?? 8080;
  await app.listen(port);
  console.log(`CredoBounty API running on http://localhost:${port}/api`);
  console.log(`API 문서(Swagger): http://localhost:${port}/api-docs`);
}
bootstrap();
