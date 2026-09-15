/**
 * 보안 강화 1탄 — "JWT_SECRET 하드코딩 폴백 제거(fail-fast)".
 *
 * 기존에는 process.env.JWT_SECRET이 없으면 코드에 박아둔 기본 문자열
 * ('credobounty-local-dev-secret-change-me')로 조용히 대체됐다. 이 방식의 문제는
 * 배포 환경에서 환경변수 설정을 깜빡해도 서버가 "정상적으로" 뜬다는 점이다 —
 * 그 순간부터 모든 JWT가 공개된(레포에 있는) 기본 시크릿으로 서명되어, 누구나
 * 같은 문자열로 토큰을 위조할 수 있는 상태가 된다.
 *
 * fail-fast 원칙: 시크릿이 없으면 "조용히 안전하지 않은 기본값을 쓰는 대신"
 * 서버 부팅 자체를 즉시 중단시켜, 운영자가 배포 단계에서 바로 문제를 알아채게 한다.
 */
export function getJwtSecretOrThrow(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      'JWT_SECRET 환경변수가 설정되지 않았습니다. .env 파일(또는 배포 환경변수)에 ' +
        'JWT_SECRET을 반드시 지정해주세요. 하드코딩된 기본값 폴백은 보안 정책상 제거되었습니다.',
    );
  }
  return secret;
}
