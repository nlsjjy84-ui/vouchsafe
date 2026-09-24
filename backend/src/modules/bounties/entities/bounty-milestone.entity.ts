import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Bounty } from './bounty.entity';
import { MilestoneStatus } from '../../../common/enums/milestone-status.enum';

/**
 * 마일스톤 분할 정산(Phase 2). 프로젝트 하나를 여러 단계로 나눠서, 각 단계가
 * 끝날 때마다 그만큼씩 에스크로에서 전문가에게 지급한다 — 기존의 "결과물 1회 제출 →
 * 1회 정산" 흐름과 달리, 장기 프로젝트에서 전문가가 중간 자금을 받을 수 있게 한다.
 * sortOrder로 화면에 보여줄 순서를 고정한다 (생성 순서와 다를 수 있어서 별도 컬럼).
 */
@Entity('bounty_milestones')
export class BountyMilestone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Bounty, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bounty_id' })
  bounty: Bounty;

  @Column({ name: 'bounty_id' })
  bountyId: string;

  @Column()
  title: string;

  @Column({ type: 'bigint' })
  amount: number;

  @Column({ name: 'sort_order', type: 'int' })
  sortOrder: number;

  @Column({ type: 'enum', enum: MilestoneStatus, default: MilestoneStatus.PENDING })
  status: MilestoneStatus;

  @Column({ type: 'text', nullable: true })
  submissionNote: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
