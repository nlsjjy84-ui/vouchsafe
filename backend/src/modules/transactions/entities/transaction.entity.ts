import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Bounty } from '../../bounties/entities/bounty.entity';
import { User } from '../../users/entities/user.entity';
import { EscrowStatus } from '../../../common/enums/escrow-status.enum';

/**
 * 기획서 10장 Transactions(에스크로 정산 내역).
 *
 * payerCi: ERD 원안 그대로 - 실명 대사(마이데이터 실명 대조, 7장)를 위해
 * 계좌 명의가 아니라 "누구 명의로 결제됐는지"의 CI 해시를 남긴다.
 * platformFeeAmount: 9장 "정상 정산 = 바운티 금액 - 플랫폼 기본 수수료" 계산 결과를 감사 로그처럼 남겨둔다.
 */
@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Bounty, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bounty_id' })
  bounty: Bounty;

  @Column({ name: 'bounty_id' })
  bountyId: string;

  @Column({ name: 'payer_ci' })
  payerCi: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'receiver_id' })
  receiver: User;

  @Column({ name: 'receiver_id', type: 'uuid', nullable: true })
  receiverId: string | null;

  @Column({ type: 'enum', enum: EscrowStatus, default: EscrowStatus.LOCKED })
  escrowStatus: EscrowStatus;

  // 실제 PG 연동(Task #14): 이 트랜잭션에 대응하는 포트원(PortOne) 결제 건의 ID.
  // 지원자 선택 시점에 서버가 미리 발급해서 프론트엔드에 내려주고, 프론트가 이
  // paymentId로 포트원 체크아웃을 띄운다. 결제 완료 후 서버는 이 값으로 PG에
  // "진짜 결제됐는지" 재확인(PaymentGatewayService.verifyPayment)한다.
  @Column({ name: 'payment_id', type: 'varchar', nullable: true })
  paymentId: string | null;

  @Column({ type: 'bigint' })
  amount: number;

  @Column({ type: 'bigint', default: 0 })
  platformFeeAmount: number;

  // 확장 기획 4장 "마일스톤 정산": 바운티를 여러 마일스톤으로 쪼갠 경우, 정산이
  // approve() 한 번에 끝나지 않고 마일스톤이 승인될 때마다 "일부만" 정산된다.
  // settledAmount는 "지금까지 실제로 전문가에게 지급된 누적 금액"이고, 이 값이
  // amount(전체 락업 금액)에 도달하면 그때 비로소 escrowStatus를 SETTLED로 바꾼다.
  // 마일스톤을 안 쓰는 일반 바운티는 settleNormally()에서 한 번에
  // settledAmount = amount 가 되므로 기존 동작과 완전히 동일하다.
  @Column({ name: 'settled_amount', type: 'bigint', default: 0 })
  settledAmount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  settledAt: Date;
}
