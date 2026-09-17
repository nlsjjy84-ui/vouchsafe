/**
 * 기획서 10장 Transactions.escrow_status.
 * Bounty.status(거래 전체 상태)와는 별개로, "자금 자체가 지금 어디 있는지"를 추적한다.
 */
export enum EscrowStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT', // 결제창은 열렸지만 PG 결제 완료 확인 전 (2026-09-16 추가)
  LOCKED = 'LOCKED', // 플랫폼 안전계좌에 묶여있음
  FROZEN = 'FROZEN', // 이의제기로 임시 동결 (9장 DISPUTED 분기)
  SETTLED = 'SETTLED', // 전문가에게 정산 완료
  REFUNDED = 'REFUNDED', // 의뢰인에게 환불 완료
}
