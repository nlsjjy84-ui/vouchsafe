import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CertificationsModule } from './modules/certifications/certifications.module';
import { BountiesModule } from './modules/bounties/bounties.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { AuditModule } from './modules/audit/audit.module';
import { ReputationModule } from './modules/reputation/reputation.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // .env 파일을 전역에서 쓸 수 있게 로드. 실제 배포 환경에서는 이 값들을
    // 플랫폼(예: Render/Railway)의 환경변수로 주입하고 .env 파일은 배포에 포함하지 않는다.
    ConfigModule.forRoot({ isGlobal: true }),

    // @Cron 데코레이터(예: AutoSettlementScheduler)를 실제로 동작시키려면
    // 이 모듈을 한 번 등록해야 한다 - NestJS의 스케줄링 엔진 자체를 켜는 역할.
    ScheduleModule.forRoot(),

    // 전역 기본 요청 제한: IP 하나당 1분에 60번. 무차별 대입 공격(brute force)의
    // 표적이 되기 쉬운 로그인/회원가입은 각 컨트롤러에서 @Throttle()로 훨씬 더
    // 엄격한 값(1분에 5번)을 덮어써서 사용한다 (auth.controller.ts 참고).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),

    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USERNAME ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'postgres',
        database: process.env.DB_NAME ?? 'credobounty',
        autoLoadEntities: true,
        // synchronize: 개발 단계 전용 — 엔티티 변경사항을 즉시 스키마에 반영.
        // 운영 배포 전에는 반드시 false로 바꾸고 마이그레이션 파일로 스키마를 관리해야 한다.
        synchronize: true,
      }),
    }),

    UsersModule,
    AuthModule,
    CertificationsModule,
    BountiesModule,
    TransactionsModule,
    DisputesModule,
    AuditModule,
    ReputationModule,
    WebhooksModule,
    NotificationsModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [
    // 이 Guard를 provider로 등록해야 ThrottlerModule.forRoot()에서 정의한 기본
    // 요청 제한이 앱 "전체" 엔드포인트에 자동 적용된다 (컨트롤러마다 일일이
    // @UseGuards(ThrottlerGuard)를 붙이지 않아도 됨).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
