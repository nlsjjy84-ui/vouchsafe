/**
 * 기획서 2장 "15대 허용 도메인 분류 지도" 그대로 매핑.
 * Category A(온라인/디지털 기술 진단) 01~05
 * Category B(오프라인/현장 진단) 06~12
 * Category C(전문 자문/자격사 영역) 13~15
 *
 * 새 도메인을 추가할 땐 반드시 "이 영역에서 해결하는 일"과
 * "거래가 끝날 때 남아야 하는 산출물"을 세트로 정의해야 한다 (기획서 도메인 정의 공통 기준).
 */
export enum DomainType {
  // Category A — 온라인/디지털 기술 진단
  BACKEND_DB_TUNING = 'BACKEND_DB_TUNING', // 01 백엔드/DB 쿼리 튜닝
  WEB3_SECURITY_AUDIT = 'WEB3_SECURITY_AUDIT', // 02 Web3 보안 코드 감사
  DEV_CODE_REVIEW = 'DEV_CODE_REVIEW', // 03 IT 개발 및 코드 리뷰
  CRAWLING_ARCHITECTURE = 'CRAWLING_ARCHITECTURE', // 04 크롤링/파싱 아키텍처 설계
  MOBILE_QA_AUTOMATION = 'MOBILE_QA_AUTOMATION', // 05 모바일 멀티 QA 및 자동화 테스트

  // Category B — 오프라인/현장 진단
  TECH_CREATOR_CONSULTING = 'TECH_CREATOR_CONSULTING', // 06 테크 크리에이터 채널 자문
  AUDIO_MASTERING_REVIEW = 'AUDIO_MASTERING_REVIEW', // 07 음원 믹싱/마스터링 검증
  INDIE_GAME_QA = 'INDIE_GAME_QA', // 08 인디 게임 구조적 QA 및 밸런스 검증
  GRAPHICS_3D_OPTIMIZATION = 'GRAPHICS_3D_OPTIMIZATION', // 09 3D 에셋 및 그래픽 최적화
  VEHICLE_DIAGNOSTICS = 'VEHICLE_DIAGNOSTICS', // 10 차량 정밀 기술 진단 (순수 정비)
  BUILDING_DEFECT_INSPECTION = 'BUILDING_DEFECT_INSPECTION', // 11 주택/건축물 하자 진단
  FIRE_SAFETY_INSPECTION = 'FIRE_SAFETY_INSPECTION', // 12 소방/안전시설물 진단

  // Category C — 전문 자문/자격사 영역
  STARTUP_CONTRACT_REVIEW = 'STARTUP_CONTRACT_REVIEW', // 13 스타트업 계약서 검토 (법률)
  TAX_STRUCTURE_FACTCHECK = 'TAX_STRUCTURE_FACTCHECK', // 14 절세 구조 팩트체크 (세무)
  REAL_ESTATE_TITLE_ANALYSIS = 'REAL_ESTATE_TITLE_ANALYSIS', // 15 부동산 권리분석
}

/**
 * 화면/AI 인사이트 문구에 쓰는 한글 라벨.
 * 프론트(frontend/src/lib/types.ts)의 DOMAIN_LABELS와 반드시 같은 문구를 유지해야 한다 —
 * 이 프로젝트는 프론트/백엔드가 코드 공유 없는 분리 구조라 값만 복제해서 맞춘다.
 */
export const DOMAIN_LABELS: Record<DomainType, string> = {
  [DomainType.BACKEND_DB_TUNING]: '백엔드/DB 쿼리 튜닝',
  [DomainType.WEB3_SECURITY_AUDIT]: 'Web3 보안 코드 감사',
  [DomainType.DEV_CODE_REVIEW]: 'IT 개발 및 코드 리뷰',
  [DomainType.CRAWLING_ARCHITECTURE]: '크롤링/파싱 아키텍처 설계',
  [DomainType.MOBILE_QA_AUTOMATION]: '모바일 멀티 QA 및 자동화 테스트',
  [DomainType.TECH_CREATOR_CONSULTING]: '테크 크리에이터 채널 자문',
  [DomainType.AUDIO_MASTERING_REVIEW]: '음원 믹싱/마스터링 검증',
  [DomainType.INDIE_GAME_QA]: '인디 게임 구조적 QA',
  [DomainType.GRAPHICS_3D_OPTIMIZATION]: '3D 에셋 및 그래픽 최적화',
  [DomainType.VEHICLE_DIAGNOSTICS]: '차량 정밀 기술 진단',
  [DomainType.BUILDING_DEFECT_INSPECTION]: '주택/건축물 하자 진단',
  [DomainType.FIRE_SAFETY_INSPECTION]: '소방/안전시설물 진단',
  [DomainType.STARTUP_CONTRACT_REVIEW]: '스타트업 계약서 검토 (법률)',
  [DomainType.TAX_STRUCTURE_FACTCHECK]: '절세 구조 팩트체크 (세무)',
  [DomainType.REAL_ESTATE_TITLE_ANALYSIS]: '부동산 권리분석',
};

export const DOMAIN_CATEGORY: Record<DomainType, 'A' | 'B' | 'C'> = {
  [DomainType.BACKEND_DB_TUNING]: 'A',
  [DomainType.WEB3_SECURITY_AUDIT]: 'A',
  [DomainType.DEV_CODE_REVIEW]: 'A',
  [DomainType.CRAWLING_ARCHITECTURE]: 'A',
  [DomainType.MOBILE_QA_AUTOMATION]: 'A',
  [DomainType.TECH_CREATOR_CONSULTING]: 'B',
  [DomainType.AUDIO_MASTERING_REVIEW]: 'B',
  [DomainType.INDIE_GAME_QA]: 'B',
  [DomainType.GRAPHICS_3D_OPTIMIZATION]: 'B',
  [DomainType.VEHICLE_DIAGNOSTICS]: 'B',
  [DomainType.BUILDING_DEFECT_INSPECTION]: 'B',
  [DomainType.FIRE_SAFETY_INSPECTION]: 'B',
  [DomainType.STARTUP_CONTRACT_REVIEW]: 'C',
  [DomainType.TAX_STRUCTURE_FACTCHECK]: 'C',
  [DomainType.REAL_ESTATE_TITLE_ANALYSIS]: 'C',
};
