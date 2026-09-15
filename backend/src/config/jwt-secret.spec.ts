import { getJwtSecretOrThrow } from './jwt-secret';

/**
 * 유닛 테스트 — getJwtSecretOrThrow (보안 강화 1탄: fail-fast)
 * JWT_SECRET이 없으면 하드코딩된 기본값으로 조용히 넘어가지 않고 반드시 예외를 던지는지 확인한다.
 */
describe('getJwtSecretOrThrow', () => {
  const original = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.JWT_SECRET = original;
  });

  it('JWT_SECRET이 설정되어 있으면 그 값을 그대로 반환한다', () => {
    process.env.JWT_SECRET = 'a-real-secret-value';
    expect(getJwtSecretOrThrow()).toBe('a-real-secret-value');
  });

  it('JWT_SECRET이 없으면(undefined) 예외를 던진다', () => {
    delete process.env.JWT_SECRET;
    expect(() => getJwtSecretOrThrow()).toThrow('JWT_SECRET 환경변수가 설정되지 않았습니다');
  });

  it('JWT_SECRET이 빈 문자열이거나 공백뿐이면 예외를 던진다', () => {
    process.env.JWT_SECRET = '   ';
    expect(() => getJwtSecretOrThrow()).toThrow();
  });
});
