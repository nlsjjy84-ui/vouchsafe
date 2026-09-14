import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MockVerificationService } from '../../mocks/mock-verification.service';
import { MockEmailService } from '../../mocks/mock-email.service';
import { AuthToken } from './entities/auth-token.entity';
import { AuthSession } from './entities/auth-session.entity';
import { AuthTokenPurpose } from '../../common/enums/auth-token-purpose.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { getRepositoryToken } from '@nestjs/typeorm';

/**
 * AuthService는 (BountiesService와 달리) dataSource.transaction()을 쓰지 않아서
 * 리포지토리를 전부 목(mock)으로 대체하는 순수 유닛 테스트로 커버하기 적합하다
 * (트랜잭션 기반 상태머신은 test/bounty-flow.e2e-spec.ts에서 실제 DB로 검증한다).
 *
 * 여기서 가장 중요하게 보는 것: 이번 세그먼트에서 추가한 보안 로직 3가지가
 * 실제로 코드 경로대로 동작하는가 -
 *  1) 가입 시 토큰을 발급하지 않는다 (이메일 인증 우회 방지)
 *  2) 이메일 미인증 계정은 비밀번호가 맞아도 로그인이 막힌다 (ForbiddenException +
 *     식별 가능한 error 코드)
 *  3) 비밀번호 재설정은 기존 세션을 전부 revoke한다 (logoutAll 호출 검증)
 */
describe('AuthService', () => {
  let authService: AuthService;
  let usersService: { findByEmail: jest.Mock; findById: jest.Mock; create: jest.Mock; updatePasswordHash: jest.Mock; markEmailVerified: jest.Mock };
  let authTokenRepo: { save: jest.Mock; create: jest.Mock; delete: jest.Mock; findOne: jest.Mock };
  let authSessionRepo: { save: jest.Mock; create: jest.Mock; update: jest.Mock };
  let mockEmail: { sendVerificationEmail: jest.Mock; sendPasswordResetEmail: jest.Mock };

  const buildUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'irrelevant',
    name: '테스트',
    role: UserRole.CLIENT,
    emailVerifiedAt: null,
    ...overrides,
  });

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updatePasswordHash: jest.fn(),
      markEmailVerified: jest.fn(),
    };
    authTokenRepo = {
      save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
      create: jest.fn().mockImplementation((x) => x),
      delete: jest.fn(),
      findOne: jest.fn(),
    };
    authSessionRepo = {
      save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
      create: jest.fn().mockImplementation((x) => x),
      update: jest.fn(),
    };
    mockEmail = {
      sendVerificationEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('signed.jwt.token') } },
        {
          provide: MockVerificationService,
          useValue: { generateCiHash: jest.fn().mockReturnValue('ci-hash') },
        },
        { provide: MockEmailService, useValue: mockEmail },
        { provide: getRepositoryToken(AuthToken), useValue: authTokenRepo },
        { provide: getRepositoryToken(AuthSession), useValue: authSessionRepo },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('이미 가입된 이메일이면 ConflictException을 던진다', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser());

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'AbcdefGhijklmn!!',
          name: '테스트',
          role: UserRole.CLIENT,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('가입 성공 시 인증 메일만 보내고 토큰(accessToken)은 반환하지 않는다', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(buildUser());

      const result = await authService.register({
        email: 'test@example.com',
        password: 'AbcdefGhijklmn!!',
        name: '테스트',
        role: UserRole.CLIENT,
      });

      expect(result).not.toHaveProperty('accessToken');
      expect(result.email).toBe('test@example.com');
      expect(mockEmail.sendVerificationEmail).toHaveBeenCalledTimes(1);
      // 인증 토큰 레코드가 EMAIL_VERIFICATION 목적으로 저장되었는지 확인
      expect(authTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: AuthTokenPurpose.EMAIL_VERIFICATION }),
      );
    });
  });

  describe('login', () => {
    it('존재하지 않는 이메일이면 UnauthorizedException(일반 메시지)을 던진다', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'nobody@example.com', password: 'whatever' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('비밀번호가 틀리면 UnauthorizedException을 던진다 (이메일 인증 여부와 무관)', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword!!', 10);
      usersService.findByEmail.mockResolvedValue(
        buildUser({ passwordHash, emailVerifiedAt: new Date() }),
      );

      await expect(
        authService.login({ email: 'test@example.com', password: 'WrongPassword!!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('비밀번호는 맞지만 이메일 미인증이면 ForbiddenException + EMAIL_NOT_VERIFIED 코드를 던진다', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword!!', 10);
      usersService.findByEmail.mockResolvedValue(
        buildUser({ passwordHash, emailVerifiedAt: null }),
      );

      await expect(
        authService.login({ email: 'test@example.com', password: 'CorrectPassword!!' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ error: 'EMAIL_NOT_VERIFIED' }),
      });
    });

    it('비밀번호가 맞고 이메일도 인증된 경우 accessToken을 발급한다', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword!!', 10);
      usersService.findByEmail.mockResolvedValue(
        buildUser({ passwordHash, emailVerifiedAt: new Date() }),
      );

      const result = await authService.login({
        email: 'test@example.com',
        password: 'CorrectPassword!!',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.email).toBe('test@example.com');
      // 세션 행이 실제로 저장되었는지 (issueToken 내부 동작) 확인
      expect(authSessionRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('resendVerification (이메일 enumeration 방지)', () => {
    it('가입되지 않은 이메일이어도 예외 없이 조용히 종료한다', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await expect(authService.resendVerification('nobody@example.com')).resolves.toBeUndefined();
      expect(mockEmail.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('이미 인증된 계정이면 조용히 종료한다 (재발송 안 함)', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser({ emailVerifiedAt: new Date() }));
      await authService.resendVerification('test@example.com');
      expect(mockEmail.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('미인증 계정이면 기존 토큰을 정리하고 새로 발송한다', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser({ emailVerifiedAt: null }));
      await authService.resendVerification('test@example.com');
      expect(authTokenRepo.delete).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: AuthTokenPurpose.EMAIL_VERIFICATION }),
      );
      expect(mockEmail.sendVerificationEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetPassword', () => {
    it('토큰이 유효하면 비밀번호를 바꾸고 해당 유저의 모든 세션을 revoke한다', async () => {
      const authToken = {
        id: 'token-1',
        userId: 'user-1',
        purpose: AuthTokenPurpose.PASSWORD_RESET,
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      };
      authTokenRepo.findOne.mockResolvedValue(authToken);

      await authService.resetPassword({ token: 'raw-token', newPassword: 'BrandNewPassw0rd!!' });

      expect(usersService.updatePasswordHash).toHaveBeenCalledWith('user-1', expect.any(String));
      // logoutAll이 호출되어 해당 유저의 살아있는 세션이 전부 revoke 되는지 확인
      expect(authSessionRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it('만료되었거나 이미 쓰인 토큰이면 UnauthorizedException을 던진다', async () => {
      authTokenRepo.findOne.mockResolvedValue(null);

      await expect(
        authService.resetPassword({ token: 'bad-token', newPassword: 'BrandNewPassw0rd!!' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout / logoutAll', () => {
    it('logout은 해당 세션 하나만 revoke한다', async () => {
      await authService.logout('session-1');
      expect(authSessionRepo.update).toHaveBeenCalledWith(
        { id: 'session-1' },
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it('logoutAll은 그 유저의 아직 살아있는 세션 전체를 revoke한다', async () => {
      await authService.logoutAll('user-1');
      expect(authSessionRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });
  });
});
