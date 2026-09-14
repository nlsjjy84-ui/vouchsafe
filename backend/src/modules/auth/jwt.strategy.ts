import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getRequiredJwtSecret } from '../../common/config/jwt-secret.util';
import { AuthSession } from './entities/auth-session.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  /** JWT ID - 이 토큰 하나를 가리키는 고유값. AuthSession.id와 1:1로 대응된다. */
  jti: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(AuthSession)
    private readonly authSessionRepository: Repository<AuthSession>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // [보안 강화] 하드코딩된 기본값 폴백을 제거했다 - jwt-secret.util.ts 상단 주석 참고.
      // JwtModule(auth.module.ts)과 반드시 같은 함수로 시크릿을 가져와야, 서명에 쓴
      // 시크릿과 검증에 쓰는 시크릿이 어긋나는(=모든 요청이 401 나는) 사고가 안 난다.
      secretOrKey: getRequiredJwtSecret(),
    });
  }

  /**
   * [보안 강화] 서명/만료만 보던 걸, "이 jti에 해당하는 세션이 서버에 아직
   * 살아있는가"까지 매 요청마다 확인하도록 강화했다. 순수 무상태 JWT라면
   * 여기서 payload만 믿고 그대로 통과시키면 되지만, 그러면 로그아웃/비밀번호
   * 변경으로도 이미 발급된 토큰을 무효화할 방법이 없다 (auth-session.entity.ts
   * 상단 설명 참고). 세션이 없거나(잘못된 jti) revoke된 상태면 서명 자체는
   * 멀쩡해도 401로 거부한다.
   */
  async validate(payload: JwtPayload) {
    const session = await this.authSessionRepository.findOne({ where: { id: payload.jti } });
    if (!session || session.revokedAt) {
      throw new UnauthorizedException('세션이 만료되었거나 로그아웃되었습니다. 다시 로그인해주세요.');
    }
    // 검증된 토큰의 payload가 req.user 로 컨트롤러에 주입된다.
    return { userId: payload.sub, email: payload.email, role: payload.role, sessionId: payload.jti };
  }
}
