import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AuthTokenPurpose } from '../../../common/enums/auth-token-purpose.enum';

/**
 * =========================================================================
 * AuthToken — 비밀번호 재설정 / 이메일 인증에 쓰는 "일회용 링크" 저장소
 * =========================================================================
 * 왜 원본 토큰이 아니라 해시(tokenHash)를 저장하나?
 *   비밀번호를 절대 평문으로 저장하지 않는 것과 같은 이유다. 만약 DB가 유출돼도
 *   공격자가 해시값만으로는 실제 링크를 재구성할 수 없다. 이메일로는 원본 토큰을
 *   보내고, DB에는 그 해시(sha256)만 남긴다 → auth.service.ts의 hashToken() 참고.
 *
 * usedAt: 토큰을 한 번 쓰면 즉시 사용 처리해서 "같은 링크 재사용"을 막는다
 * (비밀번호 재설정 링크가 이메일함에 남아있다가 나중에 재사용되는 사고 방지).
 * expiresAt: 만료 시간이 지나면 usedAt과 무관하게 무효 처리한다.
 * =========================================================================
 */
@Entity('auth_tokens')
export class AuthToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: AuthTokenPurpose })
  purpose: AuthTokenPurpose;

  // 인덱스를 걸어둔 이유: 토큰 검증 시 "이 해시값을 가진 행이 있는가"로 조회하므로,
  // 사용자 수가 늘어나도 빠르게 찾을 수 있어야 한다.
  @Index()
  @Column({ name: 'token_hash', unique: true })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
