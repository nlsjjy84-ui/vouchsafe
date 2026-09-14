import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * =========================================================================
 * AuthController — 회원가입/로그인/내정보 확인
 * =========================================================================
 * 로그인에 성공하면 "JWT 토큰"이라는 임시 출입증을 발급한다.
 * 프론트엔드는 이 토큰을 저장해뒀다가, 이후 모든 요청의 헤더에
 * `Authorization: Bearer <토큰>` 형태로 실어 보낸다.
 * 그 토큰을 검사해서 "누가 요청했는지"를 알아내는 게 JwtAuthGuard의 역할이다.
 * =========================================================================
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 회원가입
   * POST /api/auth/register
   * body: { email, password, name, role } (role: CLIENT | EXPERT | HYBRID)
   *
   * [보안 강화] 예전에는 가입 성공 시 바로 로그인된 상태처럼 토큰을 함께
   * 내려줬지만, 이제 이메일 인증 전에는 로그인 자체가 막히므로(아래 login()
   * 참고) 가입 응답에는 토큰이 없다. 계정과 인증 메일만 생성/발송하고,
   * 실제 로그인은 이메일 인증을 마친 뒤 /auth/login을 따로 호출해야 한다.
   *
   * [Rate Limiting] 같은 IP에서 1분에 5번까지만 허용 - 봇이 이메일을 자동으로
   * 바꿔가며 계정을 대량 생성하는 것을 막기 위함. 전역 기본값(1분 60번)보다
   * 훨씬 엄격하게 덮어썼다.
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * 로그인
   * POST /api/auth/login
   * body: { email, password }
   *
   * [보안 강화] 비밀번호가 맞아도 이메일 인증(emailVerifiedAt)을 마치지 않은
   * 계정은 403 Forbidden(`error: 'EMAIL_NOT_VERIFIED'`)으로 거부된다 -
   * auth.service.ts의 login() 주석 참고. 프론트는 이 응답을 보고 "인증 메일
   * 재발송" 버튼을 보여준다.
   *
   * [Rate Limiting] 같은 IP에서 1분에 5번까지만 허용 - 비밀번호 무차별 대입
   * 공격(brute force)을 늦추기 위한 가장 기본적인 방어선.
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * 비밀번호 재설정 요청
   * POST /api/auth/forgot-password
   * body: { email }
   * 이 이메일이 실제로 가입되어 있는지 여부와 무관하게 항상 같은 성공 메시지를
   * 반환한다 (이메일 존재 여부가 새어나가는 것을 막기 위함 — auth.service.ts 주석 참고).
   * 실제로 가입된 이메일이면 (Mock으로) 재설정 링크가 담긴 메일이 "발송"된다.
   *
   * [Rate Limiting] 이메일을 계속 바꿔가며 "가입 여부 자체를 캐내는" 시도나
   * 메일 폭탄(같은 사람에게 재설정 메일을 계속 보내는 것)을 막기 위해 제한.
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto.email);
    return { message: '가입된 이메일이라면 비밀번호 재설정 메일이 발송되었습니다.' };
  }

  /**
   * 비밀번호 재설정 링크 클릭 후, 새 비밀번호로 교체
   * POST /api/auth/reset-password
   * body: { token, newPassword }
   *
   * [Rate Limiting] 재설정 토큰을 무차별 대입으로 맞춰보려는 시도를 늦추기 위해 제한.
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { message: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.' };
  }

  /**
   * 이메일 인증 링크 클릭 시 호출
   * POST /api/auth/verify-email
   * body: { token }
   */
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto.token);
    return { message: '이메일 인증이 완료되었습니다.' };
  }

  /**
   * 인증 메일 재발송
   * POST /api/auth/resend-verification
   * body: { email }
   * forgot-password와 동일한 이메일 enumeration 방지 원칙 - 가입 여부/인증
   * 여부와 무관하게 항상 같은 성공 메시지를 반환한다 (auth.service.ts의
   * resendVerification 주석 참고).
   *
   * [Rate Limiting] 같은 이메일로 재발송 메일 폭탄을 보내거나, 이메일을 계속
   * 바꿔가며 "가입 여부"를 캐내려는 시도를 막기 위해 제한.
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.authService.resendVerification(dto.email);
    return { message: '가입된 이메일이고 아직 인증 전이라면 인증 메일이 발송되었습니다.' };
  }

  /**
   * 내 정보 확인 (로그인 상태 확인용)
   * GET /api/auth/me
   * @UseGuards(JwtAuthGuard)가 붙어 있어서, 유효한 토큰이 없으면 401 에러가 난다.
   * 프론트엔드가 "지금 로그인이 유지되고 있나?"를 확인할 때 부르면 된다.
   */
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { userId: string; email: string; role: string; sessionId: string }) {
    return { userId: user.userId, email: user.email, role: user.role };
  }

  /**
   * 로그아웃 (이 기기/브라우저에서만)
   * POST /api/auth/logout
   * [보안 강화] 지금 요청에 실려온 토큰의 서버 측 세션 기록만 무효화(revoke)한다.
   * 이후 같은 토큰으로 다시 요청하면 서명은 여전히 유효해도 JwtStrategy에서
   * "세션이 없다"며 401로 거부한다 - jwt.strategy.ts 참고. 프론트엔드는 이
   * 호출과 별개로 로컬에 저장해둔 토큰도 반드시 지워야 한다(서버 쪽 무효화와
   * 클라이언트 쪽 토큰 삭제 둘 다 필요).
   */
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@CurrentUser() user: { sessionId: string }) {
    await this.authService.logout(user.sessionId);
    return { message: '로그아웃되었습니다.' };
  }

  /**
   * 전체 로그아웃 (내 계정으로 로그인된 모든 기기/브라우저에서)
   * POST /api/auth/logout-all
   * "다른 기기에서 로그인된 걸 원격으로 끊고 싶을 때"(계정 탈취 의심 등) 쓴다.
   * 지금 이 요청 자체에 쓰인 세션도 함께 끊기므로, 이 계정은 어디서든
   * 다시 로그인해야 한다.
   */
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  async logoutAll(@CurrentUser() user: { userId: string }) {
    await this.authService.logoutAll(user.userId);
    return { message: '모든 기기에서 로그아웃되었습니다.' };
  }
}
