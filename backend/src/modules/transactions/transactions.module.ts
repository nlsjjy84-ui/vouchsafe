import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { Bounty } from '../bounties/entities/bounty.entity';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { MocksModule } from '../../mocks/mocks.module';

// Bounty는 BountiesModule 전체를 import(순환 의존)하지 않고, 컨트롤러가 본인 확인
// (clientId/assignedExpertId 대조)을 위해 리포지토리만 직접 조회하도록 엔티티만 등록한다.
@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Bounty]), MocksModule],
  providers: [TransactionsService],
  controllers: [TransactionsController],
  exports: [TransactionsService],
})
export class TransactionsModule {}
