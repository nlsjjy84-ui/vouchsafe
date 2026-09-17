import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CertificationsModule } from './modules/certifications/certifications.module';
import { BountiesModule } from './modules/bounties/bounties.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { PaymentsModule } from './payments/payments.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AiInsightsModule } from './modules/ai-insights/ai-insights.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // .env 파일을 전역에서 쓸 수 있게 로드. 실제 배포 환경에서는 이 값들을
    // 플랫폼(예: Render/Railway)의 환경변수로 주입하고 .env 파일은 배포에 포함하지 않는다.
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      // 배포 준비: Render/Railway 같은 매니지드 Postgres는 보통 DATABASE_URL 하나로 접속 정보를
      // 내려주고, 대부분 TLS 접속을 강제한다. DATABASE_URL이 있으면 그걸 우선 쓰고(SSL도 자동 on),
      // 없으면 기존 로컬 개발용 개별 DB_* 변수 조합을 그대로 쓴다 — 로컬 동작은 바뀌지 않는다.
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL;
        // DB_SSL=true로 명시하면 개별 변수 조합에서도 TLS를 켤 수 있다(예: Railway의 개별 변수 모드).
        const useSsl = Boolean(databaseUrl) || process.env.DB_SSL === 'true';
        const ssl = useSsl ? { rejectUnauthorized: false } : undefined;

        return {
          type: 'postgres' as const,
          ...(databaseUrl
            ? { url: databaseUrl }
            : {
                host: process.env.DB_HOST ?? 'localhost',
                port: Number(process.env.DB_PORT ?? 5432),
                username: process.env.DB_USERNAME ?? 'postgres',
                password: process.env.DB_PASSWORD ?? 'postgres',
                database: process.env.DB_NAME ?? 'credobounty',
              }),
          ssl,
          autoLoadEntities: true,
          // synchronize: 개발 단계 전용 — 엔티티 변경사항을 즉시 스키마에 반영.
          // 운영 배포 전에는 반드시 false로 바꾸고 마이그레이션 파일로 스키마를 관리해야 한다.
          synchronize: true,
        };
      },
    }),

    // 전역 기본값은 넉넉하게(분당 60회) 잡아두고, 진짜 민감한 라우트(AuthController의
    // 4개 엔드포인트)에는 @Throttle로 더 빡빡한 값(분당 5회)을 개별적으로 덮어씌운다.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),

    // 자동 정산 스케줄러(SettlementSchedulerService)가 @Cron을 쓸 수 있게 등록.
    ScheduleModule.forRoot(),

    UsersModule,
    AuthModule,
    CertificationsModule,
    BountiesModule,
    TransactionsModule,
    DisputesModule,
    PaymentsModule,
    WebhooksModule,
    DashboardModule,
    AiInsightsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
