import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { MockVerificationService } from '../../mocks/mock-verification.service';
import { MockMailService } from '../../mocks/mock-mail.service';
import { AuthTokensService } from './auth-tokens.service';
import { SessionsService } from './sessions.service';
import { AuthTokenType } from '../../common/enums/auth-token-type.enum';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 10;

// 로그인 실패 사유(가입 안 된 이메일 / 틀린 비밀번호 / 미인증 계정)를 서로 다른 메시지로
// 돌려주면 공격자가 "이 이메일은 가입돼 있다"는 사실을 알아낼 수 있다(enumeration).
// 미인증 전용 403은 예외적으로 별도 식별 코드를 두되(기획서 4탄: "식별 가능한 에러 코드로
// 차단"), 아이디/비밀번호 자체가 틀렸을 때는 항상 완전히 동일한 문구를 쓴다.
const INVALID_CREDENTIALS_MESSAGE = '이메일 또는 비밀번호가 올바르지 않습니다';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mockVerification: MockVerificationService,
    private readonly authTokens: AuthTokensService,
    private readonly mockMail: MockMailService,
    private readonly sessionsService: SessionsService,
  ) {}

  /**
   * Security 4탄: "가입 직후 자동 로그인 제거". 예전에는 회원가입 성공 = 즉시 로그인된
   * 토큰까지 함께 내려줬지만, 이제는 이메일 인증 전까지는 로그인 자체가 막히므로
   * (login()의 이메일 인증 게이트 참고) 토큰을 미리 내줘봤자 곧바로 쓸 수 없는 토큰이라
   * 의미가 없다 — 오히려 "인증 안 된 계정도 토큰만 있으면 API를 쓸 수 있다"는 혼동을 막기
   * 위해 아예 발급하지 않는다.
   */
  async register(dto: RegisterDto): Promise<{ id: string; email: string; role: string }> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('이미 가입된 이메일입니다');
    }

    // 기획서 7장 "1인 1계정" 원칙: 본인인증에서 나온 CI를 DB에 영구 매칭.
    // Mock 단계에서는 가입 시점에 임의 CI를 생성해 같은 원리를 재현한다.
    const ciHash = this.mockVerification.generateCiHash(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: dto.role,
      ciHash,
    });

    // 가입 직후 이메일 인증 토큰을 바로 발급해서 (Mock) 메일로 보낸다.
    await this.sendEmailVerification(user.id, user.email);

    return { id: user.id, email: user.email, role: user.role };
  }

  /**
   * Security 4탄: "미인증 계정 로그인 차단(403)". 통장/계좌를 1인 1계좌로 엄격하게
   * 관리하듯, 이메일 인증을 마치기 전까지는 비밀번호가 맞아도 로그인 자체를 막는다.
   * 단, 계정 존재 여부는 여전히 노출하지 않는다 — 없는 이메일이든 미인증 이메일이든
   * "비밀번호 자체가 틀렸을 가능성"과 구분되지 않도록, 아이디/비번 불일치는 항상 같은
   * 401 메시지로 통일하고, 미인증 상태는 "계정은 맞게 찾았지만 인증이 안 됐다"는 것을
   * 이미 알고 있는 그 계정 소유자에게만 의미 있는 403 + 식별 코드로 구분한다.
   */
  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: 'EMAIL_NOT_VERIFIED',
        message: '이메일 인증을 완료해야 로그인할 수 있습니다. 인증 메일을 다시 받으시려면 재발송을 요청해주세요.',
      });
    }
    return this.issueToken(user.id, user.email, user.role);
  }

  /** 로그아웃 — 지금 쓰인 토큰(jti) 하나만 서버측에서 무효화 */
  async logout(jti: string): Promise<void> {
    await this.sessionsService.revoke(jti);
  }

  /** 전체 로그아웃 — 이 계정으로 발급된 모든 기기/토큰을 한 번에 무효화 */
  async logoutAll(userId: string): Promise<void> {
    await this.sessionsService.revokeAllForUser(userId);
  }

  /** 인증 메일 재발송 (예: 회원가입 직후 메일을 못 받은 경우) */
  async requestEmailVerification(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) return; // 존재하지 않는 사용자라도 조용히 반환 (enumeration 방지)
    if (user.emailVerifiedAt) return; // 이미 인증됨 — 재발급할 필요 없음
    await this.sendEmailVerification(user.id, user.email);
  }

  private async sendEmailVerification(userId: string, email: string): Promise<void> {
    const rawToken = await this.authTokens.issue(userId, AuthTokenType.EMAIL_VERIFICATION);
    this.mockMail.sendEmailVerification(email, rawToken);
  }

  async confirmEmailVerification(rawToken: string): Promise<void> {
    const userId = await this.authTokens.consume(rawToken, AuthTokenType.EMAIL_VERIFICATION);
    await this.usersService.markEmailVerified(userId);
  }

  /**
   * 비밀번호 재설정 요청. 가입된 이메일인지 여부와 관계없이 항상 똑같이 응답한다
   * (컨트롤러에서도 응답 바디를 동일하게 유지) — "이 이메일은 가입되지 않았습니다" 같은
   * 메시지를 주면 공격자가 이메일 존재 여부를 알아낼 수 있어서(enumeration) 의도적으로 숨긴다.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return;
    const rawToken = await this.authTokens.issue(user.id, AuthTokenType.PASSWORD_RESET);
    this.mockMail.sendPasswordReset(user.email, rawToken);
  }

  /**
   * Security 3탄: 비밀번호를 바꾼 순간 그 계정의 기존 세션을 전부 무효화한다.
   * 비밀번호 재설정은 보통 "계정이 탈취된 것 같다"는 의심에서 시작되므로, 새 비밀번호로
   * 갈아끼우면서 옛 토큰들이 계속 살아있으면 재설정의 의미가 없다.
   */
  async confirmPasswordReset(rawToken: string, newPassword: string): Promise<void> {
    const userId = await this.authTokens.consume(rawToken, AuthTokenType.PASSWORD_RESET);
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.usersService.updatePasswordHash(userId, passwordHash);
    await this.sessionsService.revokeAllForUser(userId);
  }

  private async issueToken(userId: string, email: string, role: string) {
    const jti = await this.sessionsService.createSession(userId);
    const payload = { sub: userId, email, role, jti };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: userId, email, role },
    };
  }
}
