import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bounty } from '../bounties/entities/bounty.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { ReputationService } from './reputation.service';
import { ReputationController } from './reputation.controller';

@Module({
  // Bounty/Dispute 엔티티는 각각 BountiesModule/DisputesModule 소유이지만,
  // TypeOrmModule.forFeature는 여러 모듈에서 같은 엔티티를 각자 import해도
  // 안전하다 (내부적으로 같은 Repository 인스턴스를 공유한다). 평판 계산은
  // 순수 "조회 전용"이라 원본 모듈에 의존을 새로 만들기보다 이렇게 분리했다.
  imports: [TypeOrmModule.forFeature([Bounty, Dispute])],
  providers: [ReputationService],
  controllers: [ReputationController],
  exports: [ReputationService],
})
export class ReputationModule {}
