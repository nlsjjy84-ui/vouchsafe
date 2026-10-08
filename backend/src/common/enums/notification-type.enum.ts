export enum NotificationType {
  BOUNTY_APPLICATION_RECEIVED = 'BOUNTY_APPLICATION_RECEIVED', // 의뢰인: 새 지원자 도착
  BOUNTY_SELECTED = 'BOUNTY_SELECTED', // 전문가: 내가 선택됨 (에스크로 락업)
  BOUNTY_SUBMITTED = 'BOUNTY_SUBMITTED', // 의뢰인: 결과물 제출됨
  BOUNTY_SETTLED = 'BOUNTY_SETTLED', // 전문가: 정산 완료
  BOUNTY_AUTO_SETTLED = 'BOUNTY_AUTO_SETTLED', // 양측: 무이의 기간 만료 자동 정산
  MILESTONE_SETTLED = 'MILESTONE_SETTLED', // 전문가: 마일스톤 부분 정산 완료
  DISPUTE_FILED = 'DISPUTE_FILED', // 전문가: 이의제기 접수됨 (자금 동결)
  DISPUTE_RESOLVED = 'DISPUTE_RESOLVED', // 양측: 분쟁 중재 결과 반영
  CERTIFICATION_REVIEWED = 'CERTIFICATION_REVIEWED', // 신청자: 자격 인증 심사 결과
  NEW_BOUNTY_IN_FIELD = 'NEW_BOUNTY_IN_FIELD', // 전문가: 내 인증 분야에 새 프로젝트 등록 (맞춤 알림)
  APPLICATION_NOT_SELECTED = 'APPLICATION_NOT_SELECTED', // 전문가: 지원한 프로젝트에서 다른 전문가가 선정됨
}
