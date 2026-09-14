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

  // 확장 기획 4장 "동행 서비스": REMOTE(기존 원격 작업) 또는 COMPANION(실제 현장 동행).
  // 새 DomainType을 만드는 대신, 기존 도메인(부동산 권리분석/차량 진단 등)에 붙는
  // "진행 방식" 차이로 모델링했다 - service-type.enum.ts 주석 참고.
  @Column({ name: 'service_type', type: 'enum', enum: ServiceType, default: ServiceType.REMOTE })
  serviceType: ServiceType;

  // COMPANION일 때만 의미 있는 필드들. REMOTE 바운티는 항상 null.
  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  location: string | null;

  // 결과물이 제출(SUBMITTED)된 정확한 시각. updatedAt을 대신 써도 되지 않을까
  // 싶을 수 있지만, updatedAt은 이 바운티의 "아무 필드나" 바뀔 때마다 갱신되는
  // 범용 타임스탬프라 나중에 다른 필드를 추가로 건드리면 값이 흔들릴 위험이 있다.
  // "무이의 기간 만료 자동 정산" 스케줄러가 정확히 이 시점 기준으로 날짜를 계산해야
  // 하므로, 목적이 분명한 전용 컬럼을 따로 둔다 (auto-settlement.scheduler.ts 참고).
  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
