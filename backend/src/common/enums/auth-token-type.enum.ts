/**
 * AuthToken 엔티티 하나로 "이메일 인증"과 "비밀번호 재설정"을 함께 다루기 위한 구분값.
 * 두 기능은 "이메일로 1회성 링크를 보내고, 그 링크의 토큰을 검증한다"는 뼈대가
 * 완전히 같아서 테이블을 따로 두지 않고 type 컬럼으로만 나눴다.
 */
export enum AuthTokenType {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
}
