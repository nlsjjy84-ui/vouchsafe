import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfirmEmailVerificationDto } from './dto/confirm-email-verification.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type AuthUser = { userId: string; email: string; role: string; jti: string };

// 분당 5회 — 브루트포스/스팸성 호출을 막기 위한 공통 제한값.
// 4개 엔드포인트(회원가입/로그인/이메일인증 재발송/비밀번호 재설정 요청)에 동일하게 적용한다.
// AUTH_RATE_LIMIT_PER_MIN: e2e 테스트에서만 완화해서 쓰는 값 — 운영/개발(.env에 값 없음)에서는
// 항상 기본값 5가 그대로 적용된다. 실제 사용자가 60초 안에 회원가입/로그인/재발송을 5번 넘게
// 시도할 일은 거의 없지만, 테스트는 한 시나리오 안에서 그 이상을 빠르게 연속 호출하기 때문에
// (예: "로그아웃 6단계", "이메일 미인증 8단계") 프로덕션 보안 값은 그대로 두고 테스트 환경변수로만 풀어준다.
const LOGIN_RATE_LIMIT = {
  default: { limit: Number(process.env.AUTH_RATE_LIMIT_PER_MIN ?? 5), ttl: 60_000 },
};

/**
 * =========================================================================
 * AuthController — 회원가입/로그인/이메일 인증/비밀번호 재설정
 * =========================================================================
 * 로그인에 성공하면 "JWT 토큰"이라는 임시 출입증을 발급한다.
 * 프론트엔드는 이 토큰을 저장해뒀다가, 이후 모든 요청의 헤더에
 * `Authorization: Bearer <토큰>` 형태로 실어 보낸다.
 * 그 토큰을 검사해서 "누가 요청했는지"를 알아내는 게 JwtAuthGuard의 역할이다.
 *
 * 이 컨트롤러의 4개 엔드포인트(register/login/verify-email/request,
 * password-reset/request)는 무차별 대입·이메일 스팸 공격의 표적이 되기 쉬워서
 * @Throttle로 분당 5회 제한을 걸어뒀다.
 * =========================================================================
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 회원가입
   * POST /api/auth/register
   * body: { email, password, name, role } (role: CLIENT | EXPERT | HYBRID — ADMIN은 선택 불가)
   * Security 4탄: 가입 직후 자동 로그인은 제거됐다 — 이메일 인증 메일(Mock)만 발송하고,
   * 인증을 마쳐야 /auth/login으로 실제 토큰을 받을 수 있다.
   */
  @Throttle(LOGIN_RATE_LIMIT)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * 로그인
   * POST /api/auth/login
   * body: { email, password }
   * 이메일 인증을 마치지 않은 계정은 비밀번호가 맞아도 403(EMAIL_NOT_VERIFIED)으로 거부된다.
   */
  @Throttle(LOGIN_RATE_LIMIT)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * 로그아웃 — 지금 쓰던 토큰 하나만 서버측에서 무효화한다 (다른 기기의 세션은 유지).
   * POST /api/auth/logout
   */
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@CurrentUser() user: AuthUser) {
    await this.authService.logout(user.jti);
  }

  /**
   * 전체 로그아웃 — 이 계정으로 발급된 모든 토큰(모든 기기)을 한 번에 무효화한다.
   * POST /api/auth/logout-all
   */
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout-all')
  async logoutAll(@CurrentUser() user: AuthUser) {
    await this.authService.logoutAll(user.userId);
  }

  /**
   * 내 정보 확인 (로그인 상태 확인용)
   * GET /api/auth/me
   * @UseGuards(JwtAuthGuard)가 붙어 있어서, 유효한 토큰이 없으면 401 에러가 난다.
   */
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  /**
   * 이메일 인증 메일 재발송 (로그인 상태에서 호출)
   * POST /api/auth/verify-email/request
   */
  @ApiBearerAuth('JWT-auth')
  @Throttle(LOGIN_RATE_LIMIT)
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('verify-email/request')
  async requestEmailVerification(@CurrentUser() user: AuthUser) {
    await this.authService.requestEmailVerification(user.userId);
  }

  /**
   * 이메일 인증 확정
   * POST /api/auth/verify-email/confirm
   * body: { token }
   */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('verify-email/confirm')
  async confirmEmailVerification(@Body() dto: ConfirmEmailVerificationDto) {
    await this.authService.confirmEmailVerification(dto.token);
  }

  /**
   * 비밀번호 재설정 요청 (비로그인 상태에서 호출 — "비밀번호를 잊어버렸어요")
   * POST /api/auth/password-reset/request
   * body: { email }
   * 가입 여부와 무관하게 항상 204로 응답한다 (이메일 존재 여부 노출 방지).
   */
  @Throttle(LOGIN_RATE_LIMIT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('password-reset/request')
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    await this.authService.requestPasswordReset(dto.email);
  }

  /**
   * 비밀번호 재설정 확정
   * POST /api/auth/password-reset/confirm
   * body: { token, newPassword }
   */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('password-reset/confirm')
  async confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto) {
    await this.authService.confirmPasswordReset(dto.token, dto.newPassword);
  }
}
