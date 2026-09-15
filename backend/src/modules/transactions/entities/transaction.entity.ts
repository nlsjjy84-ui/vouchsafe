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

  @Column({ type: 'bigint' })
  amount: number;

  @Column({ type: 'bigint', default: 0 })
  platformFeeAmount: number;

  /**
   * 마일스톤 분할 정산(Phase 2)에서 지금까지 실제로 지급 완료된 누적 금액.
   * 일반(단일) 정산 흐름에서는 SETTLED로 바뀌는 순간 amount와 같아진다.
   * 마일스톤 흐름에서는 승인된 마일스톤 금액만큼씩 누적되다가, amount에 도달하면
   * escrowStatus가 SETTLED로 바뀐다 — "부분 정산 중"과 "완전 정산 완료"를 이 값으로 구분한다.
   */
  @Column({ type: 'bigint', default: 0 })
  settledAmount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  settledAt: Date;
}
