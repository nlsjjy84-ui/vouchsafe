import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { MockEscrowService } from '../../mocks/mock-escrow.service';
import { EscrowStatus } from '../../common/enums/escrow-status.enum';
import { Bounty } from '../bounties/entities/bounty.entity';
import { User } from '../users/entities/user.entity';

/**
 * 에스크로 자금의 상태(LOCKED/FROZEN/SETTLED/REFUNDED)만 책임지는 서비스.
 * "바운티가 지금 어느 단계인지"는 BountiesService가, "그 바운티에 걸린 돈이 지금
 * 어디 있는지"는 여기가 책임진다 — 기획서 10장 ERD가 Bounties/Transactions를
 * 분리한 이유와 같은 관심사 분리 원칙을 서비스 레이어에도 그대로 적용했다.
 *
 * Phase 2: 모든 쓰기 메서드가 선택적 `manager: EntityManager`를 받는다.
 * 호출하는 쪽(BountiesService, DisputesService)이 DataSource.transaction() 콜백
 * 안에서 이 메서드들을 부르면, 그 트랜잭션에 그대로 합류한다 — 바운티/지원서/에스크로가
 * 여러 테이블에 걸쳐 바뀌는 다단계 작업 중 하나라도 실패하면 전부 롤백되게 하기 위함.
 * manager를 안 넘기면(단독 호출) 기존처럼 기본 리포지토리로 즉시 커밋된다.
 */
@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly mockEscrow: MockEscrowService,
  ) {}

  private repo(manager?: EntityManager): Repository<Transaction> {
    return manager ? manager.getRepository(Transaction) : this.transactionRepository;
  }

  async lockEscrow(
    bounty: Bounty,
    payer: User,
    receiverId: string,
    manager?: EntityManager,
  ): Promise<Transaction> {
    await this.mockEscrow.lock(bounty.bountyAmount, payer.ciHash);
    const repo = this.repo(manager);
    const transaction = repo.create({
      bountyId: bounty.id,
      payerCi: payer.ciHash,
      receiverId,
      amount: bounty.bountyAmount,
      escrowStatus: EscrowStatus.LOCKED,
    });
    return repo.save(transaction);
  }

  private async findByBountyIdOrThrow(
    bountyId: string,
    manager?: EntityManager,
  ): Promise<Transaction> {
    const transaction = await this.repo(manager).findOne({ where: { bountyId } });
    if (!transaction) throw new NotFoundException('해당 바운티의 거래 내역을 찾을 수 없습니다');
    return transaction;
  }

  findByBountyId(bountyId: string) {
    return this.transactionRepository.findOne({ where: { bountyId } });
  }

  /** 9장 "정상 정산": 플랫폼 기본 수수료를 뗀 나머지를 전문가에게 정산 */
  async settleNormally(
    bountyId: string,
    receiver: User,
    manager?: EntityManager,
  ): Promise<Transaction> {
    const transaction = await this.findByBountyIdOrThrow(bountyId, manager);
    const fee = this.mockEscrow.calculatePlatformFee(transaction.amount);
    await this.mockEscrow.settle(transaction.amount - fee, receiver.name);

    transaction.escrowStatus = EscrowStatus.SETTLED;
    transaction.platformFeeAmount = fee;
    transaction.settledAmount = transaction.amount;
    transaction.settledAt = new Date();
    return this.repo(manager).save(transaction);
  }

  /**
   * 마일스톤 분할 정산(Phase 2): 전체 금액이 아니라 이번 마일스톤 몫(portionAmount)만큼만
   * 부분 지급한다. settledAmount가 누적되다가 전체 amount에 도달하는 순간 SETTLED로 바뀐다 —
   * 그 전까지는 LOCKED 상태를 유지해 "아직 남은 마일스톤이 있다"는 걸 나타낸다.
   */
  async settleMilestonePortion(
    bountyId: string,
    portionAmount: number,
    receiver: User,
    manager?: EntityManager,
  ): Promise<Transaction> {
    const transaction = await this.findByBountyIdOrThrow(bountyId, manager);
    const fee = this.mockEscrow.calculatePlatformFee(portionAmount);
    await this.mockEscrow.settle(portionAmount - fee, receiver.name);

    const newSettledAmount = Number(transaction.settledAmount) + portionAmount;
    transaction.settledAmount = newSettledAmount;
    transaction.platformFeeAmount = Number(transaction.platformFeeAmount) + fee;
    if (newSettledAmount >= Number(transaction.amount)) {
      transaction.escrowStatus = EscrowStatus.SETTLED;
      transaction.settledAt = new Date();
    }
    return this.repo(manager).save(transaction);
  }

  /** 9장 "의뢰인 단순 변심 환불": PG 취소 수수료(약 3%)를 의뢰인 부담으로 공제 */
  async refundClientCancel(bountyId: string, manager?: EntityManager): Promise<Transaction> {
    const transaction = await this.findByBountyIdOrThrow(bountyId, manager);
    const cancelFee = this.mockEscrow.calculateClientCancelFee(transaction.amount);
    await this.mockEscrow.refund(transaction.amount - cancelFee, transaction.payerCi);

    transaction.escrowStatus = EscrowStatus.REFUNDED;
    transaction.platformFeeAmount = cancelFee;
    return this.repo(manager).save(transaction);
  }

  /** 9장 "전문가 귀책(먹튀) 환불": 전액 환불, PG수수료는 플랫폼 충당금으로 보전 */
  async refundExpertFault(bountyId: string, manager?: EntityManager): Promise<Transaction> {
    const transaction = await this.findByBountyIdOrThrow(bountyId, manager);
    await this.mockEscrow.refund(transaction.amount, transaction.payerCi);

    transaction.escrowStatus = EscrowStatus.REFUNDED;
    return this.repo(manager).save(transaction);
  }

  /** 9장 DISPUTED 분기: 이의제기 접수 시 자금을 즉시 동결 */
  async freeze(bountyId: string, manager?: EntityManager): Promise<Transaction> {
    const transaction = await this.findByBountyIdOrThrow(bountyId, manager);
    transaction.escrowStatus = EscrowStatus.FROZEN;
    return this.repo(manager).save(transaction);
  }
}
