/**
 * 기획서 8장 "거래 상태는 PENDING → LOCKED → SUBMITTED → SETTLED 로 이어진다"
 * + 9장의 DISPUTED 예외 분기.
 *
 *   PENDING   : 의뢰 등록·전문가 지원 단계 (자금 미지급)
 *   LOCKED    : 협상 타결 + CI 실명확인 후 에스크로에 자금 락업
 *   SUBMITTED : 전문가가 결과물 제출, 의뢰인 검토 대기
 *   SETTLED   : 승인 또는 무이의 기간 만료 → 자동 정산 완료
 *   DISPUTED  : SUBMITTED 이후 기한 내 이의제기 발생 → 자금 FROZEN, 관리자 중재
 */
export enum BountyStatus {
  PENDING = 'PENDING',
  LOCKED = 'LOCKED',
  SUBMITTED = 'SUBMITTED',
  SETTLED = 'SETTLED',
  DISPUTED = 'DISPUTED',
}
