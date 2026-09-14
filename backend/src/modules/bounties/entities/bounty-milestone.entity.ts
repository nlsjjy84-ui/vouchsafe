import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Bounty } from './bounty.entity';

/**
 * 확장 기획 4장 "마일스톤 정산": 바운티 하나를 여러 단계로 쪼개서, 단계마다
 * 결과물을 제출→승인 받을 때마다 그 몫만큼만 정산되게 하는 구조.
 *
 * 전체 락업 금액(Transaction.amount) 자체는 기존과 동일하게 지원자 선택→결제
 * 완료 시점에 한 번에 잠긴다 - 달라지는 건 "그 돈을 한 번에 다 풀지, 마일스톤
 * 승인마다 나눠서 풀지"뿐이다. 그래서 이 엔티티는 Transaction과 별도로,
 * "진행 상황"만 추적한다 (실제 정산 금액 누적은 Transaction.settledAmount).
 *
 * status:
 *   PENDING   : 아직 전문가가 이 단계 결과물을 제출하지 않음
 *   SUBMITTED : 제출 완료, 의뢰인 승인 대기
 *   APPROVED  : 의뢰인이 승인 → 이 단계만큼 부분 정산 완료
 *
 * sequence: 1부터 시작하는 순번. 반드시 순서대로 제출/승인해야 한다 (한 단계
 * 건너뛰고 다음 단계부터 제출하는 것은 막는다 - BountiesService.submitMilestone).
 */
export enum BountyMilestoneStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
}

@Entity('bounty_milestones')
export class BountyMilestone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Bounty, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bounty_id' })
  bounty: Bounty;

  @Column({ name: 'bounty_id' })
  bountyId: string;

  @Column({ type: 'int' })
  sequence: number;

  @Column()
  title: string;

  // 원 단위 정수 (Bounty.bountyAmount와 같은 원칙). 모든 마일스톤 amount의 합은
  // 반드시 Bounty.bountyAmount와 같아야 한다 (BountiesService.defineMilestones 검증).
  @Column({ type: 'bigint' })
  amount: number;

  @Column({ type: 'enum', enum: BountyMilestoneStatus, default: BountyMilestoneStatus.PENDING })
  status: BountyMilestoneStatus;

  @Column({ name: 'file_url', type: 'varchar', nullable: true })
  fileUrl: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;
}
