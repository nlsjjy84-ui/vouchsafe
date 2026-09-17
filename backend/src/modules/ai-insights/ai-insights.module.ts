import { Module } from '@nestjs/common';
import { AiInsightsService } from './ai-insights.service';
import { AiInsightsController } from './ai-insights.controller';
import { BountiesModule } from '../bounties/bounties.module';
import { CertificationsModule } from '../certifications/certifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [BountiesModule, CertificationsModule, UsersModule],
  providers: [AiInsightsService],
  controllers: [AiInsightsController],
  exports: [AiInsightsService],
})
export class AiInsightsModule {}
