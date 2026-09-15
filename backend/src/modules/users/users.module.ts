import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Bounty } from '../bounties/entities/bounty.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ReputationService } from './reputation.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Bounty, Dispute])],
  providers: [UsersService, ReputationService],
  controllers: [UsersController],
  exports: [UsersService, ReputationService, TypeOrmModule],
})
export class UsersModule {}
