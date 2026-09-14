import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { UsersModule } from '../users/users.module';
import { BountiesModule } from '../bounties/bounties.module';
import { CertificationsModule } from '../certifications/certifications.module';
import { NotificationsModule } from '../notifications/notifications.module';

// 순환 참조를 피하기 위해 이 모듈만 네 도메인 모듈을 전부 가져다 쓰는 "상위"
// 모듈로 둔다 - dashboard.service.ts 상단 설명 참고. 이 모듈을 다시 참조하는
// 다른 모듈은 없어야 한다.
@Module({
  imports: [UsersModule, BountiesModule, CertificationsModule, NotificationsModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
