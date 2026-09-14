import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentWebhookLog } from './entities/payment-webhook-log.entity';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { TransactionsModule } from '../transactions/transactions.module';
import { BountiesModule } from '../bounties/bounties.module';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentWebhookLog]), TransactionsModule, BountiesModule],
  providers: [WebhooksService],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
