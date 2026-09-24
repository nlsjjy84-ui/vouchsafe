import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Bounty } from './bounty.entity';
import { User } from '../../users/entities/user.entity';

export enum ApplicationStatus {
  APPLIED = 'APPLIED',
  SELECTED = 'SELECTED',
  REJECTED = 'REJECTED',
}

/**
 * 원본 ERD에는 없는 확장 테이블.
 * 기획서 8장 PENDING 단계 설명 "전문가 지원 자격을 제한 → 등록·검증 조건을 충족한
 * 전문가만 해당 프로젝트에 지원할 수 있다"를 실제로 동작시키려면
 * "누가 지원했는지" 목록이 있어야 의뢰인이 그중 한 명을 고를 수 있다.
 * 한 전문가가 같은 프로젝트에 중복 지원하지 못하도록 (bounty, expert) unique 제약.
 */
@Entity('bounty_applications')
@Unique(['bountyId', 'expertId'])
export class BountyApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Bounty, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bounty_id' })
  bounty: Bounty;

  @Column({ name: 'bounty_id' })
  bountyId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expert_id' })
  expert: User;

  @Column({ name: 'expert_id' })
  expertId: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.APPLIED,
  })
  status: ApplicationStatus;

  @CreateDateColumn()
  createdAt: Date;
}
