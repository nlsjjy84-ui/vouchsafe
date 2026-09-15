import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * 보안 강화 3탄 — "서버측 세션 추적 도입 (AuthSession, jti)".
 *
 * 기존 JWT는 완전 무상태(stateless) 방식이라, 로그아웃 버튼을 눌러도 서버는 아무것도 모르고
 * 이미 발급된 토큰은 서명이 유효한 한(만료 시각 24h 전까지) 계속 통과했다. 이 테이블은
 * "발급된 토큰 하나하나"를 서버가 추적할 수 있게 하는 최소 단위 — JWT의 jti(JWT ID) 클레임과
 * 1:1로 매칭되는 세션 레코드다.
 *
 * 검증 흐름(JwtStrategy.validate): 서명 검증을 통과한 뒤에도, payload.jti로 이 테이블을 찾아
 * revokedAt이 null이고 아직 expiresAt 이전인지 다시 확인한다 — 로그아웃/전체 로그아웃/비밀번호
 * 변경 시 이 레코드를 revoke 처리하면, 서명은 멀쩡해도 그 토큰은 즉시 401로 거부된다.
 */
@Entity('auth_sessions')
export class AuthSession {
  // JWT의 jti 클레임과 동일한 값 (uuid) — 토큰 하나당 세션 레코드 하나.
  @PrimaryColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
