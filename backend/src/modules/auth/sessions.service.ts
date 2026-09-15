import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { LessThan, Repository } from 'typeorm';
import { AuthSession } from './entities/auth-session.entity';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // JwtModule의 signOptions.expiresIn('24h')와 동일하게 맞춘다.

/**
 * 보안 강화 3탄 — AuthSession 테이블을 다루는 서비스.
 * JwtStrategy.validate()가 매 요청마다 isActive()를 호출하므로, 이 서비스의 조회 성능이
 * 전체 API 응답 속도에 직결된다 (userId+id 단순 PK 조회라 인덱스 스캔 한 번으로 끝난다).
 */
@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(AuthSession)
    private readonly sessionRepository: Repository<AuthSession>,
  ) {}

  /** 로그인/회원가입 시 새 세션(jti)을 발급한다. 반환값을 JWT payload의 jti로 그대로 사용한다. */
  async createSession(userId: string): Promise<string> {
    const jti = randomUUID();
    const session = this.sessionRepository.create({
      id: jti,
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      revokedAt: null,
    });
    await this.sessionRepository.save(session);
    return jti;
  }

  /** JwtStrategy가 매 요청마다 호출 — 세션이 존재하고, revoke되지 않았고, 아직 만료 전인지 확인 */
  async isActive(jti: string): Promise<boolean> {
    const session = await this.sessionRepository.findOne({ where: { id: jti } });
    if (!session) return false;
    if (session.revokedAt) return false;
    if (session.expiresAt.getTime() < Date.now()) return false;
    return true;
  }

  /** 로그아웃 — 현재 요청에 쓰인 토큰 하나(jti)만 무효화 (이미 revoke된 세션을 다시 호출해도 무해) */
  async revoke(jti: string): Promise<void> {
    await this.sessionRepository.update({ id: jti }, { revokedAt: new Date() });
  }

  /**
   * 전체 로그아웃 + 비밀번호 변경 시 호출 — 이 사용자 명의로 발급된 모든 세션을 한 번에
   * 무효화한다. "계정을 탈취당했을 때"를 가정한 방어선: 비밀번호를 바꾸는 순간 이전에
   * 새어나간 토큰들이 전부 즉시 쓸모없어진다.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.sessionRepository.update({ userId }, { revokedAt: new Date() });
  }

  /** (운영 편의) 만료된 지 오래된 세션 레코드 정리 — 스케줄러 등에서 선택적으로 호출 가능 */
  async purgeExpired(): Promise<void> {
    await this.sessionRepository.delete({ expiresAt: LessThan(new Date()) });
  }
}
