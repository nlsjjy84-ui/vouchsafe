import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AuthTokenType } from '../../../common/enums/auth-token-type.enum';

/**
 * 이메일 인증 / 비밀번호 재설정 공용 토큰 테이블.
 *
 * 보안 원칙: 이메일로 보내는 실제 토큰 원문(raw token)은 DB에 절대 저장하지 않는다.
 * 저장하는 건 SHA-256 해시뿐 — 비밀번호를 bcrypt 해시로만 저장하는 것과 같은 이유다.
 * DB가 유출되더라도 그 해시로는 원문 토큰을 역산할 수 없어서, 공격자가 링크를
 * 위조해 계정을 탈취할 수 없다. 검증 시에는 사용자가 보내온 원문을 같은 방식으로
 * 해시해서 tokenHash와 일치하는지만 비교한다.
 */
@Entity('auth_tokens')
export class AuthToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Column({ type: 'enum', enum: AuthTokenType })
  type: AuthTokenType;

  @Index({ unique: true })
  @Column()
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  /** 재사용 방지: 한 번 쓰인 토큰은 usedAt이 찍히고 이후 검증에서 항상 거부된다 */
  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
