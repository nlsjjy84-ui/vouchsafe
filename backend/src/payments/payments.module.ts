import { Module } from '@nestjs/common';
import { PortOneService } from './portone.service';
import { PaymentsController } from './payments.controller';
import { BountiesModule } from '../modules/bounties/bounties.module';

@Module({
  imports: [BountiesModule],
  providers: [PortOneService],
  controllers: [PaymentsController],
  exports: [PortOneService],
})
export class PaymentsModule {}
