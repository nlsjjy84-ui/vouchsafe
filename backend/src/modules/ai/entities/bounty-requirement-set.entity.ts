import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export interface RequirementItem {
  id: string; // R1, R2 ...
  text: string;
}

/**
 * 요구사항 체크리스트. AI가 초안을 만들고, 의뢰인이 고쳐서 "확정"해야 효력이 생긴다.
 * 확정 전 초안(confirmedAt = null)은 제출물 점검의 기준으로 쓰지 않는다.
 * 공고당 1건(bountyId unique).
 */
@Entity('bounty_requirement_sets')
@Unique(['bountyId'])
export class BountyRequirementSet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bounty_id', type: 'uuid' })
  bountyId: string;

  @Column({ type: 'jsonb' })
  items: RequirementItem[];

  /** 초안을 만든 방식: AI | RULE | CLIENT(의뢰인이 직접 작성) */
  @Column({ name: 'draft_source', type: 'varchar', length: 8 })
  draftSource: string;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ name: 'confirmed_by', type: 'uuid', nullable: true })
  confirmedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
