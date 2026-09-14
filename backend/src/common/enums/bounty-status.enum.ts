/**
 * 기획서 8장 "거래 상태는 PENDING → LOCKED → SUBMITTED → SETTLED 로 이어진다"
 * + 9장의 DISPUTED 예외 분기.
 *
 *   PENDING         : 의뢰 등록·전문가 지원 단계 (자금 미지급)
 *   PAYMENT_PENDING : 지원자를 선택했지만 아직 실제 결제(PG 체크아웃)가 끝나지 않은 상태
 *   LOCKED          : 실제 결제 완료가 서버에서 확인되어 에스크로에 자금이 락업된 상태
 *   SUBMITTED       : 전문가가 결과물 제출, 의뢰인 검토 대기
 *   SETTLED         : 승인 또는 무이의 기간 만료 → 자동 정산 완료
 *   DISPUTED        : SUBMITTED 이후 기한 내 이의제기 발생 → 자금 FROZEN, 관리자 중재
 *   REFUNDED        : 관리자 중재 결과 "전문가 귀책"으로 판단되어 의뢰인에게 전액 환불 완료
 *
 * REFUNDED는 Phase 2(평판 시스템)에서 추가했다. 원래는 관리자가 환불로 중재해도
 * 바운티 상태가 DISPUTED에 계속 머물러 있었는데, 이러면 "아직 중재 대기 중인 분쟁"과
 * "환불까지 끝난 분쟁"을 상태값만으로 구분할 수 없는 문제가 있었다 (평판 점수 계산에서
 * 발견 - PROGRESS.md 참고). 그래서 종결 상태를 명확히 분리했다.
 *
 * PAYMENT_PENDING은 Task #14(실제 PortOne 연동)에서 추가했다. 예전에는 지원자를
 * 선택하는 즉시(Mock) 바로 LOCKED가 됐지만, 실제 PG 결제는 클라이언트가 체크아웃
 * 화면에서 결제를 "완료"해야만 성립하므로 그 사이에 대기 상태가 하나 더 필요하다.
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
