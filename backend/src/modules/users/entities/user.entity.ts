import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserRole } from '../../../common/enums/user-role.enum';
import { Certification } from '../../certifications/entities/certification.entity';

/**
 * 기획서 10장 Users(유저 테이블) + 7장 "1인 1계정: CI/DI를 백엔드 DB에 영구 매칭".
 *
 * ciHash: 실제 서비스라면 본인인증(PASS 등) 연동에서 나오는 CI값의 해시.
 * 지금은 MockVerificationService가 가입 시 임의로 생성해서 채워 넣는다.
 * unique 제약으로 "같은 사람이 여러 계정을 만드는 것"을 DB 레벨에서 원천 차단한다 —
 * 이게 기획서가 강조하는 통장 쪼개기/부계정 생성 방지의 핵심 장치다.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CLIENT })
  role: UserRole;

  @Column({ unique: true })
  ciHash: string;

  /**
   * 이메일 인증 완료 시각 (Phase 2). null이면 미인증 상태.
   * Security 4탄에서 이 값이 없으면 로그인 자체를 막는 게이트를 추가할 예정 —
   * 지금 그룹1 단계에서는 우선 인증 플로우(AuthToken)와 이 컬럼만 준비해둔다.
   */
  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  /**
   * "AI 기반 개인화 예산 및 소비패턴 분석" 기능용 - 사용자가 직접 설정하는
   * 월 지출 예산 목표(원). 설정 전에는 null이며, AiInsightsService가 이번 달
   * 지출과 비교해서 예산 대비 소비 인사이트를 만들 때 쓴다.
   */
  @Column({ name: 'monthly_budget_goal', type: 'bigint', nullable: true })
  monthlyBudgetGoal: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Certification, (certification) => certification.user)
  certifications: Certification[];
}
