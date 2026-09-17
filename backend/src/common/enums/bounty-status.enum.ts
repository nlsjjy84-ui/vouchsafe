/**
 * 기획서 8장 "거래 상태는 PENDING → LOCKED → SUBMITTED → SETTLED 로 이어진다"
 * + 9장의 DISPUTED 예외 분기.
 *
 *   PENDING         : 의뢰 등록·전문가 지원 단계 (자금 미지급)
 *   PAYMENT_PENDING : 전문가는 선택됐지만 아직 결제가 끝나지 않은 단계 (2026-09-16 추가) -
 *     "협상 타결"과 "실제 결제 완료"를 하나의 순간으로 뭉개지 않기 위한 상태.
 *     이 단계에서는 에스크로에 아직 자금이 잠기지 않는다 - Transactions.escrowStatus가
 *     PENDING_PAYMENT인 동안 대응된다 (BountiesService.selectApplicant 참고).
 *   LOCKED          : 결제 확인(confirm-payment) 완료 → 에스크로에 자금 락업
 *   SUBMITTED       : 전문가가 결과물 제출, 의뢰인 검토 대기
 *   SETTLED         : 승인 또는 무이의 기간 만료 → 자동 정산 완료
 *   DISPUTED        : SUBMITTED 이후 기한 내 이의제기 발생 → 자금 FROZEN, 관리자 중재
 *   REFUNDED        : DISPUTED 상태에서 관리자가 전문가 귀책으로 판단 → 의뢰인 전액 환불로 종결
 *     (2026-09-17 추가) - 프론트(lib/types.ts, StatusBadge.tsx)는 이미 이 값을 쓰고 있었는데
 *     백엔드가 실제로 이 상태로 전환한 적이 없어서, 환불 처리된 바운티가 DISPUTED에
 *     영원히 머무르는 버그가 있었다 (DisputesService.resolve의 refund=true 분기 참고).
 */
export enum BountyStatus {
  PENDING = 'PENDING',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  LOCKED = 'LOCKED',
  SUBMITTED = 'SUBMITTED',
  SETTLED = 'SETTLED',
  DISPUTED = 'DISPUTED',
  REFUNDED = 'REFUNDED',
}
