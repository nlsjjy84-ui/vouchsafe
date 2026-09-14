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

  // null이면 "아직 이메일 인증을 안 한 상태". 값이 들어가면 그 시각에 인증 완료.
  // Phase 2 시점에는 인증 안 해도 서비스 이용은 그대로 가능하게 뒀다(막으면
  // 테스트/시연이 번거로워짐) — 나중에 "인증된 사용자만 바운티 등록 가능" 같은
  // 정책을 넣고 싶으면 이 컬럼만 보고 판단하면 된다.
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  // 안심전화번호(가상번호) 기능(11장 확장)의 기반이 되는 "진짜" 연락처.
  // 이 값 자체는 절대 다른 사용자에게 그대로 노출되지 않는다 - SafeNumberMapping이
  // 발급하는 가상번호를 통해서만 간접적으로 연결된다.
  @Column({ name: 'phone_number', type: 'varchar', nullable: true })
  phoneNumber: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Certification, (certification) => certification.user)
  certifications: Certification[];
}
