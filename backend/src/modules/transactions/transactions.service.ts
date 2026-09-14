import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Transaction } from './entities/transaction.entity';
import { PaymentGatewayService } from '../../mocks/payment-gateway.interface';
import { calculatePlatformFee, calculateClientCancelFee } from '../../mocks/settlement-fee.util';
import { EscrowStatus } from '../../common/enums/escrow-status.enum';
import { Bounty } from '../bounties/entities/bounty.entity';
import { User } from '../users/entities/user.entity';

/**
 * 에스크로 자금의 상태(PENDING_PAYMENT/LOCKED/FROZEN/SETTLED/REFUNDED)만 책임지는
 * 서비스. "바운티가 지금 어느 단계인지"는 BountiesService가, "그 바운티에 걸린 돈이
 * 지금 어디 있는지"는 여기가 책임진다 — 기획서 10장 ERD가 Bounties/Transactions를
 * 분리한 이유와 같은 관심사 분리 원칙을 서비스 레이어에도 그대로 적용했다.
 *
 * Task #14(실제 PortOne 연동)에서 흐름이 2단계로 바뀌었다:
 *   1) initiatePayment(): 지원자 선택 직후 - 아직 돈은 안 걸렸고, 프론트가 결제창을
 *      띄울 수 있도록 paymentId만 미리 발급해서 PENDING_PAYMENT 상태로 대기시킨다.
 *   2) confirmLock(): 프론트에서 결제가 끝났다고 알려오면, 그 말을 그대로 믿지 않고
 *      PaymentGatewayService로 PG에 직접 재확인한 뒤에야 진짜 LOCKED로 바꾼다.
 */
@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly paymentGateway: PaymentGatewayService,
  ) {}

  /**
   * Task #26 "다단계 작업 DB 트랜잭션 처리": 이 서비스의 메서드들은 대부분
   * BountiesService/DisputesService가 "바운티 상태 변경 + 에스크로 자금 상태 변경"을
   * 하나의 원자적 작업으로 묶어야 하는 흐름(지원자 선택, 결제 확인, 정산, 환불 등)
   * 안에서 호출된다. 두 테이블(Bounty/BountyMilestone/BountyApplication과
   * Transaction)이 각각 다른 서비스 소유라, 트랜잭션을 하나로 묶으려면 시작하는
   * 쪽(BountiesService/DisputesService)이 연 TypeORM 트랜잭션의 EntityManager를
   * 여기까지 전달받아 같은 커넥션으로 쿼리를 실행해야 한다.
   *
   * 그래서 모든 쓰기 메서드에 선택적 마지막 인자 `manager?: EntityManager`를 뒀다 -
   * 넘겨받으면 그 매니저로 쿼리하고(같은 트랜잭션에 합류), 안 넘겨받으면 기존처럼
   * 독립적으로 즉시 커밋된다(단독 호출/테스트 코드 하위 호환용).
   */
  private repo(manager?: EntityManager): Repository<Transaction> {
    return manager ? manager.getRepository(Transaction) : this.transactionRepository;
  }

  /** 1단계: 결제 대기 트랜잭션 생성. 실제 자금 이동은 아직 없다. */
  async initiatePayment(
    bounty: Bounty,
    payer: User,
    receiverId: string,
    manager?: EntityManager,
  ): Promise<Transaction> {
    const paymentId = `cb_${bounty.id}_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const transaction = this.repo(manager).create({
      bountyId: bounty.id,
      payerCi: payer.ciHash,
      receiverId,
      amount: bounty.bountyAmount,
      paymentId,
      escrowStatus: EscrowStatus.PENDING_PAYMENT,
    });
    return this.repo(manager).save(transaction);
  }

  /**
   * 2단계: 프론트가 "결제 완료했어요"라고 알려온 시점에 호출된다. 반드시 PG사에
   * 직접 재확인(verifyPayment)한 뒤에만 LOCKED로 전환한다 - 검증 없이 그냥 믿고
   * 넘어가면 결제도 안 하고 바운티만 진행시키는 위변조가 가능해지기 때문이다.
   */
  async confirmLock(bountyId: string, manager?: EntityManager): Promise<Transaction> {
    const transaction = await this.findByBountyIdOrThrow(bountyId, manager);
    if (transaction.escrowStatus !== EscrowStatus.PENDING_PAYMENT) {
      throw new BadRequestException('결제 대기 상태의 거래가 아닙니다');
    }
    if (!transaction.paymentId) {
      throw new BadRequestException('결제 식별자가 없는 거래입니다');
    }

    const result = await this.paymentGateway.verifyPayment(transaction.paymentId, transaction.amount);
    if (!result.paid) {
      throw new BadRequestException(result.reason ?? '결제가 확인되지 않았습니다. 결제를 완료한 후 다시 시도해주세요.');
    }

    transaction.escrowStatus = EscrowStatus.LOCKED;
    return this.repo(manager).save(transaction);
  }

  private async findByBountyIdOrThrow(bountyId: string, manager?: EntityManager): Promise<Transaction> {
    const transaction = await this.repo(manager).findOne({ where: { bountyId } });
    if (!transaction) throw new NotFoundException('해당 바운티의 거래 내역을 찾을 수 없습니다');
    return transaction;
  }

  findByBountyId(bountyId: string) {
    return this.transactionRepository.findOne({ where: { bountyId } });
  }

  /** Task #29 포트원 웹훅 수신용: paymentId로 거래를 역으로 찾는다. */
  findByPaymentId(paymentId: string) {
    return this.transactionRepository.findOne({ where: { paymentId } });
  }

  /**
   * 9장 "정상 정산": 플랫폼 기본 수수료를 뗀 나머지를 전문가에게 정산.
   *
   * 주의: 실제 결제(PG 결제)는 이미 lock 단계에서 플랫폼 계좌로 들어와 있는 상태다.
   * 여기서 말하는 "정산"은 그중 전문가 몫을 실제로 전문가 은행 계좌로 이체하는
   * 것인데, 이건 PG의 결제/취소 API만으로는 할 수 없고 별도의 이체 시스템(오픈뱅킹
   * 이체 API 또는 PG 마켓플레이스 정산 계약)이 필요하다 - 이 부분은 사업자 등록 이후
   * 단계라서 현재는 내부 장부 처리(상태 갱신)로만 남겨둔다. PROGRESS.md 참고.
   */
  async settleNormally(bountyId: string, receiver: User, manager?: EntityManager): Promise<Transaction> {
    const transaction = await this.findByBountyIdOrThrow(bountyId, manager);
    const fee = calculatePlatformFee(transaction.amount);

    transaction.escrowStatus = EscrowStatus.SETTLED;
    transaction.platformFeeAmount = fee;
    transaction.settledAmount = transaction.amount;
    transaction.settledAt = new Date();
    return this.repo(manager).save(transaction);
  }

  /**
   * 확장 기획 4장 "마일스톤 정산": 바운티가 여러 마일스톤으로 쪼개진 경우, 의뢰인이
   * 마일스톤 하나를 승인할 때마다 그 몫만큼만 부분 정산한다. settledAmount(지금까지
   * 실제로 지급된 누적액)가 amount(전체 락업액)에 도달한 순간에만 SETTLED로 바뀐다 -
   * 그 전까지는 LOCKED 상태를 유지해서 "아직 남은 마일스톤이 있다"는 걸 나타낸다.
   *
   * amount/settledAmount는 DB의 bigint 컬럼이라 TypeORM이 문자열로 돌려준다 - 그대로
   * '+'로 더하면 숫자 덧셈이 아니라 문자열 이어붙이기가 되어버리므로 반드시 Number()로
   * 변환한 뒤 계산해야 한다 (여기서 흔히 나는 실수라 주석으로 남겨둔다).
   */
  async settleMilestone(
    bountyId: string,
    receiver: User,
    milestoneAmount: number,
    manager?: EntityManager,
  ): Promise<Transaction> {
    const transaction = await this.findByBountyIdOrThrow(bountyId, manager);
    const fee = calculatePlatformFee(milestoneAmount);

    const newSettledAmount = Number(transaction.settledAmount) + milestoneAmount;
    const newFeeAmount = Number(transaction.platformFeeAmount) + fee;
    const totalAmount = Number(transaction.amount);

    transaction.settledAmount = newSettledAmount;
    transaction.platformFeeAmount = newFeeAmount;
    if (newSettledAmount >= totalAmount) {
      transaction.escrowStatus = EscrowStatus.SETTLED;
      transaction.settledAt = new Date();
    }
    return this.repo(manager).save(transaction);
  }

  /** 9장 "의뢰인 단순 변심 환불": PG 취소 수수료(약 3%)를 의뢰인 부담으로 공제, 실제 PG 취소 호출 */
  async refundClientCancel(bountyId: string, manager?: EntityManager): Promise<Transaction> {
    const transaction = await this.findByBountyIdOrThrow(bountyId, manager);
    const cancelFee = calculateClientCancelFee(transaction.amount);
    const refundAmount = transaction.amount - cancelFee;

    if (transaction.paymentId) {
      const result = await this.paymentGateway.cancelPayment(transaction.paymentId, refundAmount, '의뢰인 단순 변심 환불');
      if (!result.cancelled) {
        throw new BadRequestException(result.reason ?? 'PG 결제 취소에 실패했습니다');
      }
    }

    transaction.escrowStatus = EscrowStatus.REFUNDED;
    transaction.platformFeeAmount = cancelFee;
    return this.repo(manager).save(transaction);
  }

  /** 9장 "전문가 귀책(먹튀) 환불": 전액 환불, PG수수료는 플랫폼 충당금으로 보전, 실제 PG 취소 호출 */
  async refundExpertFault(bountyId: string, manager?: EntityManager): Promise<Transaction> {
    const transaction = await this.findByBountyIdOrThrow(bountyId, manager);

    if (transaction.paymentId) {
      const result = await this.paymentGateway.cancelPayment(transaction.paymentId, transaction.amount, '전문가 귀책 전액 환불');
      if (!result.cancelled) {
        throw new BadRequestException(result.reason ?? 'PG 결제 취소에 실패했습니다');
      }
    }

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
