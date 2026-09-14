/**
 * 이메일로 보내는 "일회용 링크"가 어떤 용도인지 구분하는 값.
 * 비밀번호 재설정과 이메일 인증은 둘 다 "토큰 발급 → 이메일 전송 → 링크 클릭 →
 * 토큰 검증"이라는 완전히 같은 뼈대를 쓰기 때문에, 테이블/엔티티를 두 개로
 * 나누지 않고 AuthToken 하나에 purpose만 다르게 저장하도록 설계했다.
 */
export enum AuthTokenPurpose {
  PASSWORD_RESET = 'PASSWORD_RESET',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
}
