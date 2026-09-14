import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Bounty } from '../../bounties/entities/bounty.entity';

export enum DisputeStatus {
  OPEN = 'OPEN', // 접수, 자금 FROZEN 상태
  RESOLVED_REFUND = 'RESOLVED_REFUND', // 관리자 중재 결과: 의뢰인 환불
  RESOLVED_SETTLE = 'RESOLVED_SETTLE', // 관리자 중재 결과: 전문가 정산 유지
}

/**
 * 기획서 10장 Disputes(분쟁 및 감사 로그) + 9장 DISPUTED 흐름.
 * adminActionLog: 통화 이력/판단 근거를 자유 텍스트로 남긴다 (실제로는 구조화된 타임라인이 이상적이나
 * MVP에서는 텍스트 로그로 단순화).
 */
@Entity('disputes')
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Bounty, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bounty_id' })
  bounty: Bounty;

  @Column({ name: 'bounty_id' })
  bountyId: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'text', nullable: true })
  adminActionLog: string;

  @Column({ type: 'enum', enum: DisputeStatus, default: DisputeStatus.OPEN })
  status: DisputeStatus;

  @CreateDateColumn()
  createdAt: Date;
}
