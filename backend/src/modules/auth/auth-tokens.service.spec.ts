import { AuthTokensService } from './auth-tokens.service';
import { AuthTokenType } from '../../common/enums/auth-token-type.enum';
import * as crypto from 'crypto';

/**
 * 유닛 테스트 — AuthTokensService (이메일 인증/비밀번호 재설정 토큰의 발급·단일사용 검증)
 * 핵심 보안 속성: (1) DB에는 원문이 아니라 해시만 남는다, (2) 토큰은 한 번 쓰면 재사용 불가.
 */
describe('AuthTokensService', () => {
  function buildService() {
    const store = new Map<string, any>();
    const authTokenRepository = {
      create: jest.fn().mockImplementation((v) => ({ ...v })),
      save: jest.fn().mockImplementation((v) => {
        store.set(v.tokenHash, v);
        return Promise.resolve(v);
      }),
      findOne: jest.fn().mockImplementation(({ where }: any) => {
        const found = store.get(where.tokenHash);
        if (!found || found.type !== where.type) return Promise.resolve(null);
        return Promise.resolve(found);
      }),
    };
    return { service: new AuthTokensService(authTokenRepository as any), authTokenRepository };
  }

  it('issue()는 raw 토큰을 반환하지만 저장소에는 해시(hex 64자)만 저장한다', async () => {
    const { service, authTokenRepository } = buildService();
    const rawToken = await service.issue('user-1', AuthTokenType.EMAIL_VERIFICATION);

    expect(rawToken).toHaveLength(64); // randomBytes(32).toString('hex')
    const savedArg = authTokenRepository.save.mock.calls[0][0];
    expect(savedArg.tokenHash).not.toBe(rawToken);
    expect(savedArg.tokenHash).toBe(crypto.createHash('sha256').update(rawToken).digest('hex'));
  });

  it('발급한 토큰을 consume()하면 userId를 반환하고 정상 처리된다', async () => {
    const { service } = buildService();
    const rawToken = await service.issue('user-1', AuthTokenType.EMAIL_VERIFICATION);
    const userId = await service.consume(rawToken, AuthTokenType.EMAIL_VERIFICATION);
    expect(userId).toBe('user-1');
  });

  it('같은 토큰을 두 번 consume()하면 두 번째는 거부된다 (단일 사용)', async () => {
    const { service } = buildService();
    const rawToken = await service.issue('user-1', AuthTokenType.PASSWORD_RESET);
    await service.consume(rawToken, AuthTokenType.PASSWORD_RESET);
    await expect(service.consume(rawToken, AuthTokenType.PASSWORD_RESET)).rejects.toThrow(
      '토큰이 유효하지 않거나 만료되었습니다',
    );
  });

  it('타입이 다른 토큰(예: 이메일인증 토큰을 비밀번호재설정으로)으로 consume하면 거부된다', async () => {
    const { service } = buildService();
    const rawToken = await service.issue('user-1', AuthTokenType.EMAIL_VERIFICATION);
    await expect(service.consume(rawToken, AuthTokenType.PASSWORD_RESET)).rejects.toThrow();
  });
});
