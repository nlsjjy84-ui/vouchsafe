import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bounty } from './entities/bounty.entity';
import { BountyApplication } from './entities/bounty-application.entity';
import { BountySubmission } from './entities/bounty-submission.entity';
import { BountyMilestone } from './entities/bounty-milestone.entity';
import { SafeNumberMapping } from './entities/safe-number-mapping.entity';
import { BountiesService } from './bounties.service';
import { BountiesController } from './bounties.controller';
import { AutoSettlementScheduler } from './auto-settlement.scheduler';
import { CertificationsModule } from '../certifications/certifications.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UsersModule } from '../users/users.module';
import { MocksModule } from '../../mocks/mocks.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Bounty,
      BountyApplication,
      BountySubmission,
      BountyMilestone,
      SafeNumberMapping,
    ]),
    CertificationsModule,
    TransactionsModule,
    UsersModule,
    MocksModule,
    NotificationsModule,
  ],
  // AutoSettlementScheduler는 컨트롤러가 호출하는 게 아니라 @Cron이 알아서 주기적으로
  // 실행해주는 provider라서 providers 배열에만 등록한다 (컨트롤러 불필요).
  providers: [BountiesService, AutoSettlementScheduler],
  controllers: [BountiesController],
  exports: [BountiesService],
})
export class BountiesModule {}
