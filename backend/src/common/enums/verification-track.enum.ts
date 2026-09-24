/**
 * 기획서 3장 "전문가 등록은 4개의 증빙 트랙으로 나뉜다".
 * 트랙마다 요구하는 증빙 데이터와 승인 기준이 다르므로,
 * Certification 엔티티는 트랙 정보를 반드시 함께 저장해야 한다.
 */
export enum VerificationTrack {
  STANDARD = 'STANDARD', // 국가 공인 자격증 트랙
  BUSINESS = 'BUSINESS', // 사업자 경력 트랙
  PROFESSIONAL_EDUCATOR = 'PROFESSIONAL_EDUCATOR', // 실무 경력 및 교육/강사 트랙
  INFLUENCER_CREATOR = 'INFLUENCER_CREATOR', // 크리에이터 및 미디어 전문가 트랙
}

export enum VerificationStatus {
  PENDING = 'PENDING', // 제출 완료, 관리자 대조 대기
  APPROVED = 'APPROVED', // 검증 통과, 해당 도메인 프로젝트 지원 권한 부여
  REJECTED = 'REJECTED',
}
