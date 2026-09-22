import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { MockEscrowService } from '../../mocks/mock-escrow.service';
import { PaymentGatewayService } from '../../mocks/payment-gateway.interface';
import { EscrowStatus } from '../../common/enums/escrow-status.enum';
import { Bounty } from '../bounties/entities/bounty.entity';
import { User } from '../users/entities/user.entity';

/**
 * 에스크로 자금의 상태(LOCKED/FROZEN/SETTLED/REFUNDED)만 책임지는 서비스.
 * "프로젝트가 지금 어느 단계인지"는 BountiesService가, "그 프로젝트에 걸린 돈이 지금
 * 어디 있는지"는 여기가 책임진다 — 기획서 10장 ERD가 Bounties/Transactions를
 * 분리한 이유와 같은 관심사 분리 원칙을 서비스 레이어에도 그대로 적용했다.
 *
 * Phase 2: 모든 쓰기 메서드가 선택적 `manager: EntityManager`를 받는다.
 * 호출하는 쪽(BountiesService, DisputesService)이 DataSource.transaction() 콜백
 * 안에서 이 메서드들을 부르면, 그 트랜잭션에 그대로 합류한다 — 프로젝트/지원서/에스크로가
 * 여러 테이블에 걸쳐 바뀌는 다단계 작업 중 하나라도 실패하면 전부 롤백되게 하기 위함.
 * manager를 안 넘기면(단독 호출) 기존처럼 기본 리포지토리로 즉시 커밋된다.
 */
@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly mockEscrow: MockEscrowService,
    private readonly paymentGateway: PaymentGatewayService,
  ) {}

  private repo(manager?: EntityManager): Repository<Transaction> {
    return manager ? manager.getRepository(Transaction) : this.transactionRepository;
  }

  /**
   * (2026-09-16 이전의 옛 흐름) 결제 확인 단계 없이 곧바로 에스크로를 잠그던 메서드.
   * 지금은 selectApplicant → initiatePayment → confirmPayment 3단계로 나뉘어서
   * BountiesService에서는 더 이상 이 메서드를 직접 부르지 않지만, 시그니처는 남겨둔다
   * (마일스톤처럼 "결제 단계 없이 바로 잠가야" 하는 다른 흐름이 Phase 2에서 필요해질 수 있음).
   */
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

  /**
   * Task #14 결제 확인 게이트 1단계: 전문가를 선택한 직후, 아직 돈은 움직이지 않은 채로
   * "이 거래의 결제 식별자(paymentId)"만 미리 발급해서 Transaction을 PENDING_PAYMENT로
   * 만들어둔다. 프론트(lib/portone.ts)는 이 paymentId를 그대로 포트원 결제창에 넘기고,
   * 결제창이 끝나면 confirmPayment()가 같은 paymentId로 PG에 재확인한다.
   */
  async initiatePayment(
    bounty: Bounty,
    payer: User,
    receiverId: string,
    manager?: EntityManager,
  ): Promise<Transaction> {
    const paymentId = `bounty-${bounty.id}-${Date.now()}`;
    const repo = this.repo(manager);
    const transaction = repo.create({
      bountyId: bounty.id,
      payerCi: payer.ciHash,
      receiverId,
      amount: bounty.bountyAmount,
      paymentId,
      escrowStatus: EscrowStatus.PENDING_PAYMENT,
    });
    return repo.save(transaction);
  }

  /**
   * Task #14 결제 확인 게이트 2단계: 프론트가 "결제창에서 성공했다"고 알려와도 그 말을
   * 그대로 믿지 않고, 서버가 PaymentGatewayService로 PG에 직접 재확인한다 (결제 위변조
   * 방지 핵심 원칙 - payment-gateway.interface.ts 주석 참고). 검증에 성공해야만
   * 그제서야 실제로 에스크로를 잠근다(mockEscrow.lock) + LOCKED로 전이한다.
   *
   * (2026-09-23 동시성 점검) 웹훅(WebhooksService)과 프론트엔드의 결제 확인 요청이
   * 같은 결제에 대해 거의 동시에 들어올 수 있다(포트원 웹훅은 재시도 정책까지 있다).
   * 트랜잭션 안에서 호출될 때(manager가 있을 때)는 행 잠금으로 다시 읽어, 다른 경로가
   * 이미 먼저 LOCKED로 바꿔놓지 않았는지 확인한 뒤에만 진행한다.
   */
  async confirmPayment(bountyId: string, manager?: EntityManager): Promise<Transaction> {
    const transaction = await this.findByBountyIdOrThrow(bountyId, manager, true);
    if (transaction.escrowStatus !== EscrowStatus.PENDING_PAYMENT) {
      throw new BadRequestException('결제 대기 중인 거래가 아닙니다');
    }
    if (!transaction.paymentId) {
      throw new BadRequestException('결제 식별자가 없는 거래입니다');
    }

    const verified = await this.paymentGateway.verifyPayment(
      transaction.paymentId,
      Number(transaction.amount),
    );
    if (!verified.paid) {
      throw new BadRequestException(verified.reason ?? '결제 확인에 실패했습니다');
    }

    await this.mockEscrow.lock(transaction.amount, transaction.payerCi);
    transaction.escrowStatus = EscrowStatus.LOCKED;
    return this.repo(manager).save(transaction);
  }

  /**
   * lockForUpdate: pessimistic_write 행 잠금은 실제 트랜잭션(QueryRunner) 안에서만
   * 유효하므로, manager가 없는 단독 호출(예: 유닛 테스트에서 서비스만 직접 호출하는
   * 경우)에서는 조용히 무시하고 기존과 동일하게 동작한다.
   */
  private async findByBountyIdOrThrow(
    bountyId: string,
    manager?: EntityManager,
    lockForUpdate = false,
  ): Promise<Transaction> {
    const transaction = await this.repo(manager).findOne({
      where: { bountyId },
      ...(lockForUpdate && manager ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!transaction) throw new NotFoundException('해당 프로젝트의 거래 내역을 찾을 수 없습니다');
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
