/**
 * =========================================================================
 * getRequiredJwtSecret — JWT 서명/검증에 쓸 시크릿을 "안전하게" 가져온다
 * =========================================================================
 * [보안 강화] 예전에는 `process.env.JWT_SECRET ?? 'credobounty-local-dev-secret-change-me'`
 * 처럼 하드코딩된 기본값으로 조용히 폴백했다. 문제는 실제 배포 시 이 환경변수
 * 채우는 걸 깜빡해도 서버가 "정상적으로" 떠버린다는 점이다 — 그러면 이 기본값이
 * 공개 소스코드에 그대로 들어있으니, 누구나 그 문자열로 유효한 JWT를 위조해서
 * 아무 계정으로나 로그인한 것처럼 요청을 보낼 수 있다.
 *
 * 그래서 이 함수는 "조용히 약한 상태로 뜨는 것"보다 "아예 안 뜨는 것"을 택한다 -
 * JwtModule과 JwtStrategy 양쪽이 똑같이 이 함수를 통해서만 시크릿을 가져오게
 * 해서, 부팅 시점에 환경변수가 없거나 너무 짧으면 그 자리에서 예외를 던져
 * 서버가 시작조차 되지 않게 만든다 (fail loud, not fail open).
 * =========================================================================
 */

// 이 저장소의 .env.example에 들어있는 플레이스홀더 그대로 배포하면 안 된다 -
// 공개 코드라 누구나 이 문자열을 알고 있다는 뜻이므로 명시적으로 차단한다.
const KNOWN_PLACEHOLDER_VALUES = ['change-me-to-a-long-random-string'];
const MIN_SECRET_LENGTH = 32;

export function getRequiredJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.trim().length === 0) {
    throw new Error(
      'JWT_SECRET 환경변수가 설정되지 않았습니다. .env 파일에 충분히 긴 무작위 문자열을 ' +
        '채워주세요 (예: 터미널에서 `openssl rand -hex 32` 실행 후 나온 값을 그대로 사용). ' +
        '이 값이 없으면 토큰을 안전하게 서명/검증할 수 없어 서버를 의도적으로 띄우지 않습니다.',
    );
  }

  if (KNOWN_PLACEHOLDER_VALUES.includes(secret)) {
    throw new Error(
      'JWT_SECRET이 .env.example의 예시 플레이스홀더 값 그대로입니다. 이 값은 공개된 ' +
        '소스코드에 그대로 적혀있어 누구나 알 수 있으므로 절대 실제로 사용하면 안 됩니다. ' +
        '`openssl rand -hex 32`로 새로 생성한 값으로 교체해주세요.',
    );
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET이 너무 짧습니다 (현재 ${secret.length}자, 최소 ${MIN_SECRET_LENGTH}자 권장). ` +
        '짧거나 추측하기 쉬운 시크릿은 무차별 대입으로 뚫려 토큰 위조로 이어질 수 있습니다.',
    );
  }

  return secret;
}
