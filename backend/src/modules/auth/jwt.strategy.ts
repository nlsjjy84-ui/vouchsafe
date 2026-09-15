import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getJwtSecretOrThrow } from '../../config/jwt-secret';
import { SessionsService } from './sessions.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  jti: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly sessionsService: SessionsService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecretOrThrow(),
    });
  }

  // 검증된 토큰의 payload가 req.user 로 컨트롤러에 주입된다.
  // Security 3탄: 서명이 멀쩡해도 서버측에서 해당 세션(jti)이 이미 revoke됐다면 401로 거부한다
  // (로그아웃/전체 로그아웃/비밀번호 변경 후에도 탈취된 토큰이 계속 유효한 문제를 막기 위함).
  async validate(payload: JwtPayload) {
    const isActive = await this.sessionsService.isActive(payload.jti);
    if (!isActive) {
      throw new UnauthorizedException('세션이 만료되었거나 로그아웃되었습니다. 다시 로그인해주세요.');
    }
    return { userId: payload.sub, email: payload.email, role: payload.role, jti: payload.jti };
  }
}
