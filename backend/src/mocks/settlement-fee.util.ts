/**
 * 기획서 9장 정산 규칙표의 수수료 계산 로직. PG 연동 방식과 무관한 순수 계산이라
 * (Mock이든 실제 포트원이든 항상 똑같이 적용되므로) 특정 서비스에 묶어두지 않고
 * 별도 유틸 함수로 분리했다.
 *
 * - 정상 정산: 프로젝트금액 - 플랫폼 기본 수수료(전문가 몫), PG수수료는 플랫폼이 부담
 * - 단순변심 환불: 원금 - PG 결제/취소 수수료(약 3%, 의뢰인 부담)
 * - 전문가 귀책 환불: 전액 환불, PG수수료는 플랫폼 충당금으로 보전
 */
const PG_CANCEL_FEE_RATE = 0.03; // PG 결제/취소 수수료 약 3% 내외

/**
 * 플랫폼 수수료 (2026-10-13 확정). 전문가가 내고 의뢰인은 0원, 거래가 안 되면(환불) 0원이다.
 * 견적을 보낼 때마다 받는 방식(숨고)은 쓰지 않는다.
 *
 * 누진식: 구간 시작 수수료 + 1만 원 올라갈 때마다 추가금. 앞 구간이 끝나는 금액이 다음 구간의
 * 시작 수수료라 경계에서 갑자기 뛰지 않는다. 금액이 커질수록 1만 원당 추가금이 줄어든다.
 *   10만 원 15,000원 → 20만 원 30,000원 → 30만 원 42,000원 → 50만 원 62,000원
 *   → 100만 원 102,000원 → 500만 원 342,000원
 *
 * 두 가지 기준을 만족한다 (테스트로 1만~2천만 원 전 구간 확인).
 *  1) 최소 거래 금액(10만 원)부터 어느 금액에서도 크몽 표시 요율(16.4% + 결제망 3.3% = 19.7%)보다 싸다
 *     — 가장 높은 비율이 15%
 *  2) 어느 금액에서도 플랫폼에 돈이 남는다 — 1만 원당 추가금(최소 500원 = 5%)이 결제·에스크로 비용 3.96%보다 크다
 * 1만 원 미만 끝자리는 세지 않는다(105,000원 → 15,000원).
 */
export const FEE_STEPS: ReadonlyArray<{ from: number; start: number; per10k: number }> = [
  { from: 100_000, start: 15_000, per10k: 1_500 },
  { from: 200_000, start: 30_000, per10k: 1_200 },
  { from: 300_000, start: 42_000, per10k: 1_000 },
  { from: 500_000, start: 62_000, per10k: 800 },
  { from: 1_000_000, start: 102_000, per10k: 600 },
  { from: 5_000_000, start: 342_000, per10k: 500 },
];
/** 최소 거래 금액. 검증된 전문가의 진단·검수라 10만 원부터 받는다(크몽식 소액 재능 거래와 구분). */
export const MIN_DEAL_AMOUNT = 100_000;

export function calculatePlatformFee(amount: number): number {
  if (!amount || amount <= 0) return 0;
  const tenK = Math.floor(amount / 10_000) * 10_000;
  // 최소 거래 금액보다 작은 예전 거래(데이터 이전분)는 첫 구간 비율(15%)로 받는다
  if (tenK < FEE_STEPS[0].from) return Math.min(amount, (tenK / 10_000) * FEE_STEPS[0].per10k);
  let step = FEE_STEPS[0];
  for (const s of FEE_STEPS) if (tenK >= s.from) step = s;
  return Math.min(amount, step.start + ((tenK - step.from) / 10_000) * step.per10k);
}

/**
 * 마일스톤 분할 정산 때 이번 몫의 수수료. 마일스톤마다 따로 매기면 끝자리 버림·누진 구간 때문에 합계가 달라지므로,
 * 전체 금액 기준 수수료를 금액 비율로 나누고 마지막 정산이 남은 몫을 가져간다(합계가 정확히 맞게).
 */
export function milestoneFee(totalFee: number, totalAmount: number, portion: number, settledBefore: number, feeBefore: number): number {
  if (settledBefore + portion >= totalAmount) return Math.max(0, totalFee - feeBefore);
  return Math.floor((totalFee * portion) / totalAmount);
}

export function calculateClientCancelFee(amount: number): number {
  return Math.floor(amount * PG_CANCEL_FEE_RATE);
}
