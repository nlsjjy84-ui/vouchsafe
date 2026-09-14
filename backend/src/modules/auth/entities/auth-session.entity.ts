import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * =========================================================================
 * AuthSession — 로그인 시 발급된 JWT 1개당 1행씩 생기는 "서버 측 세션 원장"
 * =========================================================================
 * 원래 JWT는 "완전히 무상태(stateless)"라서, 한 번 발급하면 만료 시간(24h)이
 * 되기 전까지는 서버가 그 토큰을 강제로 무효화할 방법이 없다 - 로그아웃을
 * 눌러도, 비밀번호를 바꿔도, 그 전에 발급된 토큰은 여전히 유효한 출입증으로
 * 24시간 동안 계속 쓸 수 있다는 뜻이다. 이건 "로그아웃"이라는 말의 상식적인
 * 의미와 어긋난다.
 *
 * 그래서 완전한 무상태 JWT 대신, "발급된 토큰마다 서버가 그 존재를 기록해두고,
 * 매 요청마다 그 기록이 아직 살아있는지 확인하는" 하이브리드 모델로 바꿨다:
 *   1) 로그인/회원가입 성공 → JWT를 발급하면서 그 JWT의 jti(JWT ID) 클레임과
 *      동일한 값으로 이 테이블에 행을 하나 만든다 (issueToken 참고)
 *   2) 이후 모든 인증된 요청에서 JwtStrategy.validate()가 "서명이 유효한가"뿐
 *      아니라 "이 jti에 해당하는 세션이 DB에 아직 살아있는가(revokedAt이
 *      비어있는가)"까지 확인한다
 *   3) 로그아웃(POST /auth/logout) → 그 요청에 쓰인 세션 하나만 revokedAt을 채움
 *   4) 전체 로그아웃(POST /auth/logout-all) → 그 사용자의 모든 세션을 한꺼번에 revoke
 *   5) 비밀번호 재설정(resetPassword) → "계정이 탈취됐을 수도 있다"는 신호이므로,
 *      새 비밀번호로 로그인하기 전까지 발급되어 있던 모든 세션을 강제로 revoke
 *
 * id를 uuid로 랜덤 생성하지 않고 "JWT의 jti 클레임 값을 그대로 PK로 쓰는" 이유:
 * 검증할 때 "이 jti를 가진 행을 찾아라"는 조회 하나로 끝나야 하기 때문이다
 * (jti ↔ 세션 행이 서로 다른 랜덤값이면 매핑 테이블이 하나 더 필요해진다).
 * =========================================================================
 */
@Entity('auth_sessions')
export class AuthSession {
  /** JWT payload의 `jti` 클레임과 동일한 값 (randomUUID) */
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /** JWT 자체의 만료 시각과 동일 - 세션 테이블이 무한정 쌓이는 걸 막기 위한 정리 기준 */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  /**
   * null이면 "아직 유효한 세션". 값이 채워지면 그 순간부터 이 jti를 가진 JWT는
   * 서명이 아무리 유효해도(만료 전이라도) JwtStrategy에서 401로 거부된다.
   */
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
