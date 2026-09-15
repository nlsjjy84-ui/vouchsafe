import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import helmet from 'helmet';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { MockMailService } from '../../src/mocks/mock-mail.service';

/**
 * e2e 테스트용 Nest 애플리케이션 부트스트랩.
 * main.ts의 bootstrap()과 최대한 동일한 파이프라인(helmet, ValidationPipe, 전역 필터,
 * /api 프리픽스, rawBody)을 그대로 재현한다 — "테스트 환경에서만 통과하고 실제로는
 * 안 되는" 괴리를 막기 위해, 실제 요청 처리 경로와 동일한 설정으로 검증한다.
 * app.listen()은 호출하지 않고 supertest가 http 서버 핸들을 직접 잡아 쓴다.
 */
export async function createTestApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });

  app.use(helmet());
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api');

  await app.init();
  return app;
}

/** 테스트마다 겹치지 않는 이메일을 만들기 위한 짧은 랜덤 suffix */
export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * MockMailService는 실제로 메일을 보내지 않고 로그만 남기므로, e2e 테스트가 "메일함"에
 * 접근할 방법이 없다. 실제 사용자라면 받은 메일에서 링크를 클릭하는 것과 동등하게,
 * 여기서는 MockMailService.sendEmailVerification()/sendPasswordReset() 호출 인자로
 * 넘어온 raw 토큰을 스파이로 가로챈다 — DB 내부 해시를 몰래 들여다보는 게 아니라,
 * "메일로 나간 원문 그대로"를 확인하는 것과 동일한 관측 지점이다.
 */
export function captureMailTokens(app: NestExpressApplication) {
  const mailService = app.get(MockMailService);
  const verificationTokens: Record<string, string> = {};
  const resetTokens: Record<string, string> = {};

  jest.spyOn(mailService, 'sendEmailVerification').mockImplementation((to: string, raw: string) => {
    verificationTokens[to] = raw;
  });
  jest.spyOn(mailService, 'sendPasswordReset').mockImplementation((to: string, raw: string) => {
    resetTokens[to] = raw;
  });

  return { verificationTokens, resetTokens };
}
