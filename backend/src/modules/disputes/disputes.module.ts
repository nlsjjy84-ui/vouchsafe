import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispute } from './entities/dispute.entity';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';
import { BountiesModule } from '../bounties/bounties.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dispute]),
    BountiesModule,
    TransactionsModule,
    UsersModule,
    NotificationsModule,
  ],
  providers: [DisputesService],
  controllers: [DisputesController],
})
export class DisputesModule {}
