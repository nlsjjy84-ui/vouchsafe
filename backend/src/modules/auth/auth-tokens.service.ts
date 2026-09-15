import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { AuthToken } from './entities/auth-token.entity';
import { AuthTokenType } from '../../common/enums/auth-token-type.enum';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24시간
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1시간 (비밀번호 재설정은 더 짧게)

/**
 * 이메일 인증 / 비밀번호 재설정 토큰의 발급-저장-검증을 전담하는 서비스.
 * AuthToken.tokenHash 참고: DB에는 SHA-256 해시만 저장하고, 원문(raw token)은
 * 발급 시 한 번만 호출자에게 돌려준 뒤(메일 발송용) 서버 어디에도 남기지 않는다.
 */
@Injectable()
export class AuthTokensService {
  constructor(
    @InjectRepository(AuthToken)
    private readonly authTokenRepository: Repository<AuthToken>,
  ) {}

  private hash(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  private ttlFor(type: AuthTokenType): number {
    return type === AuthTokenType.PASSWORD_RESET
      ? PASSWORD_RESET_TTL_MS
      : EMAIL_VERIFICATION_TTL_MS;
  }

  /** 새 토큰을 발급하고 해시만 저장한 뒤, 원문을 호출자에게 반환한다 (메일 발송 용도) */
  async issue(userId: string, type: AuthTokenType): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hash(rawToken);
    const expiresAt = new Date(Date.now() + this.ttlFor(type));

    const authToken = this.authTokenRepository.create({
      userId,
      type,
      tokenHash,
      expiresAt,
      usedAt: null,
    });
    await this.authTokenRepository.save(authToken);
    return rawToken;
  }

  /**
   * 원문 토큰을 검증하고, 유효하면 즉시 사용 처리(usedAt)한 뒤 userId를 반환한다.
   * 만료/재사용/존재하지 않음을 구분하지 않고 모두 같은 400 메시지로 응답한다 —
   * 공격자에게 "어떤 이유로 실패했는지" 힌트를 주지 않기 위한 의도적인 설계.
   */
  async consume(rawToken: string, type: AuthTokenType): Promise<string> {
    const tokenHash = this.hash(rawToken);
    const authToken = await this.authTokenRepository.findOne({
      where: { tokenHash, type },
    });

    if (!authToken || authToken.usedAt || authToken.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('토큰이 유효하지 않거나 만료되었습니다');
    }

    authToken.usedAt = new Date();
    await this.authTokenRepository.save(authToken);
    return authToken.userId;
  }
}
