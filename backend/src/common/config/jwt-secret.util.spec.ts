import { getRequiredJwtSecret } from './jwt-secret.util';

/**
 * getRequiredJwtSecret은 "약한 시크릿으로 조용히 뜨는 것"을 막기 위한 함수라,
 * 정상 케이스보다 오히려 "언제 예외를 던지는지"가 테스트의 핵심이다.
 * process.env.JWT_SECRET을 각 테스트마다 저장/복원해서 다른 테스트 파일에
 * 영향을 주지 않도록 한다.
 */
describe('getRequiredJwtSecret', () => {
  const originalEnv = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.JWT_SECRET = originalEnv;
  });

  it('충분히 긴 시크릿이 설정되어 있으면 그대로 반환한다', () => {
    process.env.JWT_SECRET = 'a'.repeat(32);
    expect(getRequiredJwtSecret()).toBe('a'.repeat(32));
  });

  it('JWT_SECRET이 없으면 예외를 던진다', () => {
    delete process.env.JWT_SECRET;
    expect(() => getRequiredJwtSecret()).toThrow(/설정되지 않았습니다/);
  });

  it('JWT_SECRET이 빈 문자열/공백뿐이면 예외를 던진다', () => {
    process.env.JWT_SECRET = '   ';
    expect(() => getRequiredJwtSecret()).toThrow(/설정되지 않았습니다/);
  });

  it('.env.example의 플레이스홀더 값 그대로면 예외를 던진다', () => {
    process.env.JWT_SECRET = 'change-me-to-a-long-random-string';
    expect(() => getRequiredJwtSecret()).toThrow(/플레이스홀더/);
  });

  it('최소 길이(32자)보다 짧으면 예외를 던진다', () => {
    process.env.JWT_SECRET = 'short-secret';
    expect(() => getRequiredJwtSecret()).toThrow(/너무 짧습니다/);
  });

  it('정확히 32자면 통과한다 (경계값)', () => {
    process.env.JWT_SECRET = 'b'.repeat(32);
    expect(() => getRequiredJwtSecret()).not.toThrow();
  });

  it('31자면 거부한다 (경계값)', () => {
    process.env.JWT_SECRET = 'b'.repeat(31);
    expect(() => getRequiredJwtSecret()).toThrow(/너무 짧습니다/);
  });
});
