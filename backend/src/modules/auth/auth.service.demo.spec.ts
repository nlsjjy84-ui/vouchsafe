import { NotFoundException } from '@nestjs/common';
import { AuthService, isDemoEmail } from './auth.service';

/** 데모 둘러보기: 시드된 데모 계정으로만 토큰을 발급하고, DEMO_LOGIN=off 면 막는다. */
describe('AuthService.demoLogin', () => {
  const users: Record<string, any> = {
    'client@demo.com': { id: 'c1', email: 'client@demo.com', role: 'CLIENT' },
    'expert@demo.com': { id: 'e1', email: 'expert@demo.com', role: 'EXPERT' },
  };
  function build() {
    const usersService = { findByEmail: jest.fn((email: string) => Promise.resolve(users[email] ?? null)) };
    const jwtService = { sign: jest.fn(() => 'signed-token') };
    const sessionsService = { createSession: jest.fn(() => Promise.resolve('jti-1')) };
    const service = new AuthService(usersService as any, jwtService as any, {} as any, {} as any, {} as any, sessionsService as any);
    return { service, usersService, jwtService };
  }
  afterEach(() => { delete process.env.DEMO_LOGIN; });

  it('의뢰인 데모 계정으로 토큰을 발급한다', async () => {
    const { service, jwtService } = build();
    const result = await service.demoLogin('client');
    expect(result).toEqual({ accessToken: 'signed-token', user: { id: 'c1', email: 'client@demo.com', role: 'CLIENT' } });
    expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'c1', email: 'client@demo.com', role: 'CLIENT', jti: 'jti-1' });
  });

  it('전문가 데모 계정으로 토큰을 발급한다', async () => {
    const { service } = build();
    await expect(service.demoLogin('expert')).resolves.toMatchObject({ user: { role: 'EXPERT' } });
  });

  it('DEMO_LOGIN=off 이면 404로 막는다', async () => {
    process.env.DEMO_LOGIN = 'off';
    const { service, usersService } = build();
    await expect(service.demoLogin('client')).rejects.toBeInstanceOf(NotFoundException);
    expect(usersService.findByEmail).not.toHaveBeenCalled();
  });

  it('데모 계정이 아직 없으면 404', async () => {
    const { service, usersService } = build();
    usersService.findByEmail.mockResolvedValueOnce(null);
    await expect(service.demoLogin('client')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('데모 이메일만 데모로 본다', () => {
    expect(isDemoEmail('expert@demo.com')).toBe(true);
    expect(isDemoEmail('someone@gmail.com')).toBe(false);
    expect(isDemoEmail('demo.com@evil.com')).toBe(false);
  });
});
