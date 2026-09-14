/**
 * 기획서 9장 정산 규칙표의 수수료 계산 로직. PG 연동 방식과 무관한 순수 계산이라
 * (Mock이든 실제 포트원이든 항상 똑같이 적용되므로) 특정 서비스에 묶어두지 않고
 * 별도 유틸 함수로 분리했다.
 *
 * - 정상 정산: 바운티금액 - 플랫폼 기본 수수료(전문가 몫), PG수수료는 플랫폼이 부담
 * - 단순변심 환불: 원금 - PG 결제/취소 수수료(약 3%, 의뢰인 부담)
 * - 전문가 귀책 환불: 전액 환불, PG수수료는 플랫폼 충당금으로 보전
 */
const PLATFORM_FEE_RATE = 0.1; // 플랫폼 기본 수수료 10% (MVP 가정치 - 실제 요율은 사업 결정 필요)
const PG_CANCEL_FEE_RATE = 0.03; // PG 결제/취소 수수료 약 3% 내외

export function calculatePlatformFee(amount: number): number {
  return Math.floor(amount * PLATFORM_FEE_RATE);
}

export function calculateClientCancelFee(amount: number): number {
  return Math.floor(amount * PG_CANCEL_FEE_RATE);
}
