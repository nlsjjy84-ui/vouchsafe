import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OffersController } from './offers.controller';
import { HomeStatsController } from './home-stats.controller';
import { OffersService } from './offers.service';
import { OffersSeeder } from './offers.seeder';
import { ExpertOffer } from './entities/expert-offer.entity';
import { OfferMessage } from './entities/offer-message.entity';
import { OfferReport } from './entities/offer-report.entity';
import { User } from '../users/entities/user.entity';
import { Bounty } from '../bounties/entities/bounty.entity';
import { Certification } from '../certifications/entities/certification.entity';
import { BountiesModule } from '../bounties/bounties.module';
import { CertificationsModule } from '../certifications/certifications.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExpertOffer, OfferMessage, OfferReport, User, Bounty, Certification]),
    BountiesModule,
    CertificationsModule,
    NotificationsModule,
    StorageModule,
  ],
  controllers: [OffersController, HomeStatsController],
  providers: [OffersService, OffersSeeder],
})
export class OffersModule {}
