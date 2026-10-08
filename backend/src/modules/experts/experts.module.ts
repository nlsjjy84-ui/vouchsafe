import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpertsController } from './experts.controller';
import { ExpertsService } from './experts.service';
import { User } from '../users/entities/user.entity';
import { Bounty } from '../bounties/entities/bounty.entity';
import { Certification } from '../certifications/entities/certification.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Bounty, Certification, Dispute]), UsersModule],
  controllers: [ExpertsController],
  providers: [ExpertsService],
})
export class ExpertsModule {}
