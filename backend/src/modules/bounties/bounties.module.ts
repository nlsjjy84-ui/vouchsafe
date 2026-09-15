import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bounty } from './entities/bounty.entity';
import { BountyApplication } from './entities/bounty-application.entity';
import { BountySubmission } from './entities/bounty-submission.entity';
import { BountyMilestone } from './entities/bounty-milestone.entity';
import { BountiesService } from './bounties.service';
import { BountiesController } from './bounties.controller';
import { SettlementSchedulerService } from './settlement-scheduler.service';
import { CertificationsModule } from '../certifications/certifications.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UsersModule } from '../users/users.module';
import { StorageModule } from '../../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SafeNumberModule } from '../safe-number/safe-number.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bounty, BountyApplication, BountySubmission, BountyMilestone]),
    CertificationsModule,
    TransactionsModule,
    UsersModule,
    StorageModule,
    NotificationsModule,
    SafeNumberModule,
  ],
  providers: [BountiesService, SettlementSchedulerService],
  controllers: [BountiesController],
  exports: [BountiesService, SettlementSchedulerService],
})
export class BountiesModule {}
