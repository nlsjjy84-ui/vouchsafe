export enum MilestoneStatus {
  PENDING = 'PENDING', // 정의만 되고 아직 제출 전
  SUBMITTED = 'SUBMITTED', // 전문가가 이 마일스톤 몫의 결과물을 제출
  APPROVED = 'APPROVED', // 의뢰인이 승인 → 이 마일스톤 금액만큼 부분 정산 완료
}
