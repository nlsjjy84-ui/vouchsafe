import { SessionsService } from './sessions.service';

/**
 * 유닛 테스트 — SessionsService (보안 강화 3탄: AuthSession 기반 서버측 세션 추적)
 * JwtStrategy.validate()가 매 요청 호출하는 isActive()의 세 가지 거부 조건
 * (없음/revoke됨/만료됨)이 각각 정확히 동작하는지가 이 서비스의 핵심이다.
 */
describe('SessionsService', () => {
  function buildService(findOneResult: any) {
    const sessionRepository = {
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockImplementation((v) => Promise.resolve(v)),
      findOne: jest.fn().mockResolvedValue(findOneResult),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    return { service: new SessionsService(sessionRepository as any), sessionRepository };
  }

  it('createSession은 uuid 형태의 jti를 반환하고 만료시각이 미래로 설정된 세션을 저장한다', async () => {
    const { service, sessionRepository } = buildService(null);
    const jti = await service.createSession('user-1');
    expect(jti).toMatch(/^[0-9a-f-]{36}$/);
    expect(sessionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: jti, userId: 'user-1', revokedAt: null }),
    );
    const savedArg = sessionRepository.save.mock.calls[0][0];
    expect(savedArg.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('세션이 존재하고 revoke되지 않았고 만료 전이면 isActive는 true', async () => {
    const { service } = buildService({
      id: 'jti-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(service.isActive('jti-1')).resolves.toBe(true);
  });

  it('세션이 revoke된 상태면 isActive는 false', async () => {
    const { service } = buildService({
      id: 'jti-1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(service.isActive('jti-1')).resolves.toBe(false);
  });

  it('세션의 expiresAt이 이미 지났으면 isActive는 false', async () => {
    const { service } = buildService({
      id: 'jti-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(service.isActive('jti-1')).resolves.toBe(false);
  });

  it('존재하지 않는 jti는 isActive가 false다 (findOne이 null 반환)', async () => {
    const { service } = buildService(null);
    await expect(service.isActive('nonexistent')).resolves.toBe(false);
  });

  it('revokeAllForUser는 해당 userId 조건으로 update를 호출한다', async () => {
    const { service, sessionRepository } = buildService(null);
    await service.revokeAllForUser('user-1');
    expect(sessionRepository.update).toHaveBeenCalledWith(
      { userId: 'user-1' },
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
  });
});
