import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayoutAccount } from './entities/payout-account.entity';
import { User } from '../users/entities/user.entity';
import { PayoutService } from './payout.service';
import { PayoutController } from './payout.controller';
import { PayoutRequest } from './entities/payout-request.entity';
import { PayoutRequestService } from './payout-request.service';
import { PayoutRequestController } from './payout-request.controller';
import { PayoutSeeder } from './payout.seeder';
import { Transaction } from '../transactions/entities/transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PayoutAccount, PayoutRequest, Transaction, User])],
  providers: [PayoutService, PayoutRequestService, PayoutSeeder],
  controllers: [PayoutController, PayoutRequestController],
  exports: [PayoutService],
})
export class PayoutModule {}
