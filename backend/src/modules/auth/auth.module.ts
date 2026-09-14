import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { MocksModule } from '../../mocks/mocks.module';
import { AuthToken } from './entities/auth-token.entity';
import { AuthSession } from './entities/auth-session.entity';
import { getRequiredJwtSecret } from '../../common/config/jwt-secret.util';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthToken, AuthSession]),
    UsersModule,
    MocksModule,
    PassportModule,
    // registerAsync + useFactory: process.env를 "모듈 로드 시점"이 아니라 "실제 인스턴스
    // 생성 시점"에 읽는다. ConfigModule.forRoot()가 .env를 로드하는 시점과 어긋나면
    // (파일 import 순서상 이 값이 undefined일 때 baked-in 되는 버그) 토큰 서명에 쓰인 시크릿과
    // JwtStrategy가 검증에 쓰는 시크릿이 달라져 모든 요청이 401이 나는 문제가 있었다 — 재발 방지.
    JwtModule.registerAsync({
      // [보안 강화] 하드코딩된 기본값 폴백을 제거했다 - jwt-secret.util.ts 상단 주석 참고.
      useFactory: () => ({
        secret: getRequiredJwtSecret(),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
