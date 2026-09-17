import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { DomainType } from '../../../common/enums/domain-type.enum';
import { BountyStatus } from '../../../common/enums/bounty-status.enum';
import { ServiceType } from '../../../common/enums/service-type.enum';

/**
 * 기획서 10장 Bounties(전문 바운티 공고).
 *
 * assignedExpertId: 원본 ERD에는 없지만, 8장 "PENDING: 검증된 전문가만 바운티에 접근한다"
 * 단계에서 여러 전문가가 지원(BountyApplication)한 뒤 의뢰인이 한 명을 선택하는 흐름을
 * 구현하려면 "최종 선택된 전문가가 누구인지"를 Bounty에 들고 있어야 한다.
 * → PROGRESS.md에 이 확장 사유를 기록해둔다.
 */
@Entity('bounties')
export class Bounty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: User;

  @Column({ name: 'client_id' })
  clientId: string;

  @Column({ type: 'enum', enum: DomainType })
  domainType: DomainType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  // 원 단위 정수로 저장 (부동소수점 오차 방지 - 돈을 다루는 테이블의 기본 원칙)
  @Column({ type: 'bigint' })
  bountyAmount: number;

  @Column({ type: 'enum', enum: BountyStatus, default: BountyStatus.PENDING })
  status: BountyStatus;

  @Column({ name: 'assigned_expert_id', type: 'uuid', nullable: true })
  assignedExpertId: string | null;

  /** 동행 서비스 확장 (Phase 2): REMOTE(기본, 원격) | COMPANION(현장 동행) */
  @Column({ type: 'enum', enum: ServiceType, default: ServiceType.REMOTE })
  serviceType: ServiceType;

  /** COMPANION일 때만 의미 있음 — 만나기로 한 장소 */
  @Column({ type: 'text', nullable: true })
  companionLocation: string | null;

  /** COMPANION일 때만 의미 있음 — 만나기로 한 시각 */
  @Column({ type: 'timestamptz', nullable: true })
  companionMeetingAt: Date | null;

  /**
   * SUBMITTED로 전환된 시각 (Phase 2). 자동 정산 스케줄러가
   * "무이의 기간(5일)이 지난 SUBMITTED 바운티"를 찾을 때 이 값을 기준으로 삼는다.
   */
  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  /**
   * 공개 거래 사례(투명성 신뢰 지표) - 의뢰인이 직접 매기는 평가.
   * 1.0~10.0, 0.5점 단위 (프론트/백엔드 모두 0.5 step으로 검증한다).
   * "시스템 점수"(ReputationService, 자동 계산 · 조작 불가)와는 별개로 나란히 공개한다 -
   * 완료율/분쟁승률/처리속도처럼 실데이터 기반은 아니지만, "실제로 거래해본 사람의
   * 주관적 평가"라는 다른 종류의 신호라 의도적으로 분리해서 보여준다.
   */
  @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true })
  clientRating: string | null;

  @Column({ type: 'text', nullable: true })
  clientRatingNote: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
