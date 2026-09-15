import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { BountiesModule } from '../bounties/bounties.module';
import { CertificationsModule } from '../certifications/certifications.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [BountiesModule, CertificationsModule, UsersModule, NotificationsModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
