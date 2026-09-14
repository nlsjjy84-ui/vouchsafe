/**
 * 기획서 10장 Transactions.escrow_status.
 * Bounty.status(거래 전체 상태)와는 별개로, "자금 자체가 지금 어디 있는지"를 추적한다.
 */
export enum EscrowStatus {
  // 실제 PG 연동(Task #14) 추가: 지원자 선택 직후에는 아직 클라이언트가
  // 결제(PortOne 체크아웃)를 완료하지 않은 상태다. 결제 완료가 서버에서
  // 실제로 확인(GET /payments/:id 검증)된 다음에야 LOCKED로 넘어간다.
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  LOCKED = 'LOCKED', // 플랫폼 안전계좌에 묶여있음 (실제 PG 결제 완료 확인됨)
  FROZEN = 'FROZEN', // 이의제기로 임시 동결 (9장 DISPUTED 분기)
  SETTLED = 'SETTLED', // 전문가에게 정산 완료
  REFUNDED = 'REFUNDED', // 의뢰인에게 환불 완료
}
