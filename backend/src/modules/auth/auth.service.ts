import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { MockVerificationService } from '../../mocks/mock-verification.service';
import { MockEmailService } from '../../mocks/mock-email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthToken } from './entities/auth-token.entity';
import { AuthSession } from './entities/auth-session.entity';
import { AuthTokenPurpose } from '../../common/enums/auth-token-purpose.enum';

const SALT_ROUNDS = 10;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000; // 30분
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24시간
// JwtModule(auth.module.ts)의 signOptions.expiresIn과 반드시 같은 값이어야 한다 -
// JWT 자체의 만료 시각과 AuthSession.expiresAt이 어긋나면 "JWT는 만료됐는데
// 세션 행은 안 지워졌다" 같은 불일치가 생긴다 (지금은 정리 배치가 없어 당장
// 문제는 안 되지만, 나중에 만료 세션 정리 스케줄러를 추가할 때 기준이 된다).
const ACCESS_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24시간

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mockVerification: MockVerificationService,
    private readonly mockEmail: MockEmailService,
    @InjectRepository(AuthToken)
    private readonly authTokenRepository: Repository<AuthToken>,
    @InjectRepository(AuthSession)
    private readonly authSessionRepository: Repository<AuthSession>,
  ) {}

  async register(dto: RegisterDto) {
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
      phoneNumber: dto.phoneNumber ?? null,
    });

    // 가입 직후 이메일 인증 메일을 (Mock으로) 발송한다.
    await this.issueAndSendToken(user.id, user.email, AuthTokenPurpose.EMAIL_VERIFICATION);

    // [보안 강화] 예전에는 가입 직후 바로 로그인 토큰까지 발급해서 "가입 = 즉시
    // 로그인"이었다. 그런데 이러면 바로 아래 login()에 추가한 "이메일 인증 전
    // 로그인 차단" 정책이 가입 시점에는 그냥 우회되는 셈이다(애초에 로그인
    // 절차를 안 거치고 들어와 있으니까). 그래서 이제 가입은 토큰을 발급하지
    // 않고, 계정 생성 + 인증 메일 발송까지만 하고 끝낸다 - 실제로 서비스를
    // 쓰려면 이메일 인증 → 로그인 절차를 그대로 거쳐야 한다.
    return {
      email: user.email,
      message: `회원가입이 완료되었습니다. ${user.email}로 발송된 인증 메일의 링크를 클릭한 후 로그인해주세요.`,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }
    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }

    // [보안 강화] "통장/계좌를 1인 1계좌로 관리하듯 이메일도 동일하게" 요청하신
    // 부분 - 비밀번호가 맞아도 이메일 인증을 마치기 전에는 로그인 자체를 막는다.
    // 지금까지는 인증 여부와 무관하게 서비스를 계속 쓸 수 있어서, 본인 소유가
    // 확인되지 않은 이메일로도 바운티 등록/지원, 결제 같은 핵심 기능을 그대로
    // 쓸 수 있었다 - 신원 확인 체계 전체("1인 1계정" 원칙, User.ciHash 참고)의
    // 전제를 깨는 구멍이었다.
    // error 필드를 'EMAIL_NOT_VERIFIED'라는 식별 가능한 값으로 던지는 이유:
    // AllExceptionsFilter가 이 error 필드를 그대로 응답에 실어주기 때문에,
    // 프론트가 "비밀번호가 틀렸다"(401)와 "인증을 안 했다"(403 +
    // EMAIL_NOT_VERIFIED)를 구분해서 후자일 때만 "인증 메일 재발송" 버튼을
    // 보여줄 수 있다.
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        error: 'EMAIL_NOT_VERIFIED',
        message: '이메일 인증 후 로그인할 수 있습니다. 인증 메일을 다시 받으시겠어요?',
      });
    }

    return this.issueToken(user.id, user.email, user.role);
  }

  /**
   * 인증 메일 재발송.
   * forgot-password(requestPasswordReset)와 완전히 같은 이메일 enumeration
   * 방지 원칙을 쓴다: 이 이메일이 가입되어 있는지, 이미 인증됐는지 여부와
   * 무관하게 컨트롤러는 항상 같은 성공 메시지를 반환한다. 실제로 메일을
   * 보낼지 말지만 여기서 조용히 갈린다.
   */
  async resendVerification(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user || user.emailVerifiedAt) {
      return; // 가입 안 된 이메일이거나 이미 인증된 계정이면 아무 티도 내지 않는다
    }

    // 이전에 발급됐던 인증 링크가 남아있다면 정리하고 새로 발급한다
    // (requestPasswordReset과 동일한 패턴 - 옛 링크와 새 링크가 같이 떠다니는 것 방지).
    await this.authTokenRepository.delete({
      userId: user.id,
      purpose: AuthTokenPurpose.EMAIL_VERIFICATION,
    });
    await this.issueAndSendToken(user.id, user.email, AuthTokenPurpose.EMAIL_VERIFICATION);
  }

  /**
   * 비밀번호 재설정 메일 요청.
   *
   * 보안 원칙: 이 이메일이 실제로 가입되어 있는지 아닌지를 응답으로 절대 알려주지
   * 않는다("가입된 이메일이 없습니다" 같은 메시지를 주면, 공격자가 이메일 주소
   * 하나하나를 넣어보면서 "어떤 이메일이 가입되어 있는지"를 알아낼 수 있다 —
   * 이걸 이메일 enumeration 공격이라 부른다). 그래서 존재하든 안 하든 컨트롤러는
   * 항상 똑같은 성공 메시지를 반환하고, 실제로 메일을 보낼지 말지만 여기서 갈린다.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return; // 사용자가 없어도 조용히 종료 (아래 보안 원칙 설명 참고)
    }

    // 이전에 발급했던 재설정 링크가 남아있다면 모두 정리한다.
    // (메일함에 여러 개의 재설정 링크가 남아있다가 헷갈리는 걸 방지 + 테이블 정리)
    await this.authTokenRepository.delete({
      userId: user.id,
      purpose: AuthTokenPurpose.PASSWORD_RESET,
    });

    const rawToken = await this.issueAndSendToken(
      user.id,
      user.email,
      AuthTokenPurpose.PASSWORD_RESET,
    );
    void rawToken; // 이메일로만 전달되고 응답에는 절대 포함하지 않는다
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const authToken = await this.consumeToken(dto.token, AuthTokenPurpose.PASSWORD_RESET);
    const passwordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await this.usersService.updatePasswordHash(authToken.userId, passwordHash);

    // [보안 강화] 비밀번호를 재설정했다는 건 "계정이 탈취됐을 수도 있다"는
    // 신호와 같다. 만약 공격자가 몰래 로그인해서 계속 유효한 토큰을 들고
    // 있는 상태라면, 진짜 주인이 비밀번호를 바꿔도 그 토큰은 만료 시간(24h)
    // 까지 계속 살아남는다 - 그래서 새 비밀번호가 적용되는 순간, 그 전에
    // 발급되어 있던 모든 세션(=모든 기기의 로그인 상태)을 강제로 끊는다.
    // 지금 비밀번호를 바꾼 요청 자체는 로그인 상태가 아니라 이메일 링크로만
    // 이뤄지므로, "재설정 직후 자동 로그인"은 없다 - 새 비밀번호로 다시
    // 로그인해야 한다 (auth.controller.ts 응답 메시지와 동일한 원칙).
    await this.logoutAll(authToken.userId);
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const authToken = await this.consumeToken(rawToken, AuthTokenPurpose.EMAIL_VERIFICATION);
    await this.usersService.markEmailVerified(authToken.userId);
  }

  /** 원본 토큰을 만들어 DB에는 해시만 저장하고, Mock 이메일 서비스로 링크를 "발송"한다 */
  private async issueAndSendToken(
    userId: string,
    email: string,
    purpose: AuthTokenPurpose,
  ): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const ttlMs =
      purpose === AuthTokenPurpose.PASSWORD_RESET
        ? PASSWORD_RESET_TTL_MS
        : EMAIL_VERIFICATION_TTL_MS;

    await this.authTokenRepository.save(
      this.authTokenRepository.create({
        userId,
        purpose,
        tokenHash,
        expiresAt: new Date(Date.now() + ttlMs),
        usedAt: null,
      }),
    );

    const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
    if (purpose === AuthTokenPurpose.PASSWORD_RESET) {
      this.mockEmail.sendPasswordResetEmail(
        email,
        `${frontendOrigin}/reset-password?token=${rawToken}`,
      );
    } else {
      this.mockEmail.sendVerificationEmail(
        email,
        `${frontendOrigin}/verify-email?token=${rawToken}`,
      );
    }

    return rawToken;
  }

  /** 토큰을 검증하고, 문제가 없으면 즉시 "사용됨" 처리한 뒤 그 토큰 레코드를 반환 */
  private async consumeToken(rawToken: string, purpose: AuthTokenPurpose): Promise<AuthToken> {
    const tokenHash = this.hashToken(rawToken);
    const authToken = await this.authTokenRepository.findOne({ where: { tokenHash, purpose } });

    if (!authToken || authToken.usedAt || authToken.expiresAt < new Date()) {
      throw new UnauthorizedException('유효하지 않거나 만료된 링크입니다. 다시 요청해주세요.');
    }

    authToken.usedAt = new Date();
    await this.authTokenRepository.save(authToken);
    return authToken;
  }

  /** 이메일로 보내는 원본 토큰과, DB에 저장하는 해시를 연결하는 단방향 함수 */
  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * [보안 강화] JWT를 서명하기 전에, 그 토큰 하나를 가리키는 세션 행을 먼저
   * DB에 만든다. jti(JWT ID) 클레임에 그 행의 id를 그대로 넣어서, 이후
   * JwtStrategy.validate()가 "이 jti의 세션이 아직 살아있는가"만 확인하면
   * 되게 한다 (auth-session.entity.ts 상단 설명 참고).
   */
  private async issueToken(userId: string, email: string, role: string) {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);

    await this.authSessionRepository.save(
      this.authSessionRepository.create({ id: sessionId, userId, expiresAt, revokedAt: null }),
    );

    const payload = { sub: userId, email, role, jti: sessionId };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: userId, email, role },
    };
  }

  /**
   * 로그아웃: 지금 이 요청에 쓰인 토큰의 세션 하나만 revoke한다.
   * 다른 기기/브라우저에서 로그인해둔 세션은 그대로 유지된다 -
   * "이 기기에서만 로그아웃"이라는 사용자의 일반적인 기대와 일치시키기 위함.
   * (모든 기기에서 한꺼번에 끊고 싶으면 logoutAll을 쓴다.)
   */
  async logout(sessionId: string): Promise<void> {
    await this.authSessionRepository.update({ id: sessionId }, { revokedAt: new Date() });
  }

  /**
   * 전체 로그아웃: 이 사용자 명의로 발급된 "아직 살아있는" 모든 세션을 한꺼번에
   * revoke한다. resetPassword()에서도 재사용한다 (비밀번호를 바꾸면 모든 기기의
   * 로그인 상태를 강제로 끊어야 하므로).
   * revokedAt이 이미 채워진 행은 건드리지 않는다 - 굳이 다시 쓸 이유가 없다.
   */
  async logoutAll(userId: string): Promise<void> {
    await this.authSessionRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
