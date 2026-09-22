/**
 * 백엔드(backend/src/common/enums/*)와 같은 값을 갖도록 맞춰둔 타입들.
 * 지금은 프론트/백엔드가 완전히 분리된 별도 프로젝트라 코드를 공유하지 않고 값만 복제했다.
 * (나중에 모노레포 + 공유 패키지로 묶으면 이 중복을 없앨 수 있다 - Phase 2 후보)
 */

export type DomainType =
  | 'BACKEND_DB_TUNING'
  | 'WEB3_SECURITY_AUDIT'
  | 'DEV_CODE_REVIEW'
  | 'CRAWLING_ARCHITECTURE'
  | 'MOBILE_QA_AUTOMATION'
  | 'TECH_CREATOR_CONSULTING'
  | 'AUDIO_MASTERING_REVIEW'
  | 'INDIE_GAME_QA'
  | 'GRAPHICS_3D_OPTIMIZATION'
  | 'VEHICLE_DIAGNOSTICS'
  | 'BUILDING_DEFECT_INSPECTION'
  | 'FIRE_SAFETY_INSPECTION'
  | 'STARTUP_CONTRACT_REVIEW'
  | 'TAX_STRUCTURE_FACTCHECK'
  | 'REAL_ESTATE_TITLE_ANALYSIS';

// 화면에 보여줄 한글 라벨. 기획서 2장 도메인 이름 그대로 사용.
export const DOMAIN_LABELS: Record<DomainType, string> = {
  BACKEND_DB_TUNING: '백엔드/DB 쿼리 튜닝',
  WEB3_SECURITY_AUDIT: 'Web3 보안 코드 감사',
  DEV_CODE_REVIEW: 'IT 개발 및 코드 리뷰',
  CRAWLING_ARCHITECTURE: '크롤링/파싱 아키텍처 설계',
  MOBILE_QA_AUTOMATION: '모바일 멀티 QA 및 자동화 테스트',
  TECH_CREATOR_CONSULTING: '테크 크리에이터 채널 자문',
  AUDIO_MASTERING_REVIEW: '음원 믹싱/마스터링 검증',
  INDIE_GAME_QA: '인디 게임 구조적 QA',
  GRAPHICS_3D_OPTIMIZATION: '3D 에셋 및 그래픽 최적화',
  VEHICLE_DIAGNOSTICS: '차량 정밀 기술 진단',
  BUILDING_DEFECT_INSPECTION: '주택/건축물 하자 진단',
  FIRE_SAFETY_INSPECTION: '소방/안전시설물 진단',
  STARTUP_CONTRACT_REVIEW: '스타트업 계약서 검토 (법률)',
  TAX_STRUCTURE_FACTCHECK: '절세 구조 팩트체크 (세무)',
  REAL_ESTATE_TITLE_ANALYSIS: '부동산 권리분석',
};

export type VerificationTrack =
  | 'STANDARD'
  | 'BUSINESS'
  | 'PROFESSIONAL_EDUCATOR'
  | 'INFLUENCER_CREATOR';

export const TRACK_LABELS: Record<VerificationTrack, string> = {
  STANDARD: '국가 공인 자격증 트랙',
  BUSINESS: '사업자 경력 트랙',
  PROFESSIONAL_EDUCATOR: '실무 경력 및 교육/강사 트랙',
  INFLUENCER_CREATOR: '크리에이터 및 미디어 전문가 트랙',
};

export type BountyStatus =
  | 'PENDING'
  | 'PAYMENT_PENDING'
  | 'LOCKED'
  | 'SUBMITTED'
  | 'SETTLED'
  | 'DISPUTED'
  | 'REFUNDED';

export const BOUNTY_STATUS_LABELS: Record<BountyStatus, string> = {
  PENDING: '지원자 모집중',
  PAYMENT_PENDING: '결제 대기중',
  LOCKED: '진행중 (에스크로 락업)',
  SUBMITTED: '결과물 검토중',
  SETTLED: '정산 완료',
  DISPUTED: '이의제기중',
  REFUNDED: '환불 완료 (전문가 귀책)',
};

export type EscrowStatus = 'PENDING_PAYMENT' | 'LOCKED' | 'FROZEN' | 'SETTLED' | 'REFUNDED';

export interface User {
  id: string;
  email: string;
  role: 'CLIENT' | 'EXPERT' | 'HYBRID' | 'ADMIN';
  name?: string;
}

export type ServiceType = 'REMOTE' | 'COMPANION';

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  REMOTE: '비대면 진행',
  COMPANION: '현장 동행',
};

export interface Bounty {
  id: string;
  clientId: string;
  domainType: DomainType;
  title: string;
  description: string;
  bountyAmount: number;
  status: BountyStatus;
  assignedExpertId: string | null;
  serviceType: ServiceType;
  scheduledAt: string | null;
  location: string | null;
  createdAt: string;
}

export type ApplicationStatus = 'APPLIED' | 'SELECTED' | 'REJECTED';

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: '지원함 (결과 대기중)',
  SELECTED: '선정됨',
  REJECTED: '선정되지 않음',
};

export interface BountyApplication {
  id: string;
  bountyId: string;
  expertId: string;
  message: string | null;
  status: ApplicationStatus;
  createdAt: string;
  expert?: { id: string; name: string; email: string };
  // 마이페이지 대시보드(GET /dashboard/me)는 지원 목록에 대상 프로젝트 정보를
  // 함께 JOIN해서 내려준다 (dashboard.service.ts 참고) - 그 응답에서만 채워진다.
  bounty?: Bounty;
}

export interface Transaction {
  id: string;
  bountyId: string;
  escrowStatus: EscrowStatus;
  paymentId: string | null;
  amount: number;
  platformFeeAmount: number;
  settledAt: string | null;
}

export interface Certification {
  id: string;
  domainType: DomainType;
  track: VerificationTrack;
  licenseNumber: string;
  verifiedStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote: string | null;
  createdAt?: string;
}

/**
 * 백엔드 common/enums/notification-type.enum.ts와 값을 맞췄다 (이전엔 프론트가
 * 추측으로 다른 문자열 세트를 써서 실제 API가 내려주는 값과 하나도 안 맞았음 -
 * 지금은 n.type을 직접 분기하는 화면이 없어서 런타임 영향은 없었지만, 타입
 * 자체가 거짓말을 하고 있었던 것이라 바로잡는다).
 */
export type NotificationType =
  | 'BOUNTY_APPLICATION_RECEIVED'
  | 'BOUNTY_SELECTED'
  | 'BOUNTY_SUBMITTED'
  | 'BOUNTY_SETTLED'
  | 'BOUNTY_AUTO_SETTLED'
  | 'MILESTONE_SETTLED'
  | 'DISPUTE_FILED'
  | 'DISPUTE_RESOLVED'
  | 'CERTIFICATION_REVIEWED';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedBountyId: string | null;
  isRead: boolean;
  createdAt: string;
}

/**
 * GET /ai-insights/me 응답 형태.
 * "AI 기반 개인화 예산/소비패턴 분석" + "AI & 마이데이터 기반 개인화 금융관리"
 * 두 부제 주제를 구현한 API - 백엔드 AiInsightsService와 필드를 맞춰뒀다.
 */
export interface DomainBreakdownItem {
  domainType: DomainType;
  domainLabel: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface MonthlyTrendItem {
  month: string;
  spent: number;
  earned: number;
}

/** 기능1: 예산 목표 대비 소비 */
export interface BudgetInsight {
  goal: number | null;
  thisMonthSpent: number;
  usageRate: number | null; // 0~100+, goal이 없으면 null
}

/** 기능2: 소비 이상탐지 하이라이트 */
export interface SpendingAnomaly {
  domainType: DomainType;
  domainLabel: string;
  thisMonthAmount: number;
  avgPrevAmount: number;
  increasePct: number;
}

/** 기능3: 다음 달 지출/수익 예측 */
export interface NextMonthForecast {
  nextMonthSpent: number;
  nextMonthEarned: number;
}

export interface MyInsightsResponse {
  role: 'CLIENT' | 'EXPERT' | 'HYBRID' | 'ADMIN';
  summary: {
    totalSpent: number;
    totalEarned: number;
    activeAsClient: number;
    activeAsExpert: number;
    settledCount: number;
    disputedCount: number;
    approvedCertificationCount: number;
  };
  spendingByDomain: DomainBreakdownItem[];
  earningByDomain: DomainBreakdownItem[];
  monthlyTrend: MonthlyTrendItem[];
  budget: BudgetInsight;
  spendingAnomaly: SpendingAnomaly | null;
  forecast: NextMonthForecast | null;
  insights: string[];
}

/** GET /disputes/open (관리자 분쟁 목록) 응답 형태 */
export interface AdminDispute {
  id: string;
  bountyId: string;
  reason: string;
  status: 'OPEN' | 'RESOLVED_REFUND' | 'RESOLVED_SETTLE';
  adminActionLog: string | null;
  createdAt: string;
  bounty?: Bounty;
}

/**
 * GET /cases (PublicCasesController, 로그인 불필요) 응답 형태 - "공개 거래 사례".
 * 백엔드 BountiesService.listPublicCases()와 필드를 맞췄다. 의뢰인/전문가 실명,
 * 정확한 금액, 프로젝트 제목은 절대 내려오지 않는다 (익명화 원칙).
 */
export interface PublicBountyCase {
  id: string;
  domainType: DomainType;
  domainLabel: string;
  durationDays: number;
  amountBand: string;
  systemScore: number; // 0~10, 자동 계산(완료율/분쟁승률/처리속도) - 조작 불가
  clientRating: number | null; // 1.0~10.0, 의뢰인이 직접 매긴 점수 (아직 없으면 null)
  clientRatingNote: string | null;
  expertHandle: string;
  settledAt: string;
}

/** GET /dashboard/me (마이페이지 통합 대시보드, Task #31) 응답 형태 */
export interface MyDashboard {
  profile: {
    id: string;
    email: string;
    name: string;
    role: 'CLIENT' | 'EXPERT' | 'HYBRID' | 'ADMIN';
    emailVerifiedAt: string | null;
  };
  summary: {
    clientBountyCount: number;
    clientBountyInProgressCount: number;
    expertApplicationCount: number;
    expertSelectedCount: number;
    certificationApprovedCount: number;
    unreadNotificationCount: number;
  };
  clientBounties: Bounty[];
  expertApplications: BountyApplication[];
  certifications: Certification[];
}
