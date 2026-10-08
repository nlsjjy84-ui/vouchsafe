import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegionsController } from './regions.controller';
import { RegionsService } from './regions.service';
import { GeocoderService } from './geocoder.service';
import { User } from '../users/entities/user.entity';
import { Bounty } from '../bounties/entities/bounty.entity';
import { Certification } from '../certifications/entities/certification.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Bounty, Certification]), UsersModule],
  controllers: [RegionsController],
  providers: [RegionsService, GeocoderService],
})
export class RegionsModule {}
