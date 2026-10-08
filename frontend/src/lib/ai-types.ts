/** AI 기능 응답 타입 (백엔드 modules/ai 와 같은 모양을 유지한다) */
export interface AiMeta {
  source: 'AI' | 'RULE';
  provider: string | null;
  model: string | null;
  executionId: string | null;
  fallbackReason: string | null;
  advisoryNotice: string;
}

export interface AiStatus {
  provider: string;
  configured: boolean;
  mode: 'AI' | 'RULE';
  model: string | null;
}

export interface RequirementItem {
  id: string;
  text: string;
}

export interface RequirementSet {
  id: string;
  bountyId: string;
  items: RequirementItem[];
  draftSource: 'AI' | 'RULE' | 'CLIENT';
  confirmedAt: string | null;
}

export interface RankingRow {
  applicationId: string;
  expertId: string;
  expertName: string | null;
  label: string;
  totalScore: number;
  breakdown: Record<'reputation' | 'certification' | 'messageFit' | 'messageEffort', { points: number; max: number; note: string }>;
}

export interface CheckLine {
  id: string;
  text: string;
  verdict: 'MET' | 'NOT_MET' | 'UNVERIFIABLE';
  evidence: string | null;
  comment: string;
}

export interface PriceReference {
  enoughData: boolean;
  sampleCount?: number;
  message?: string;
  stats?: { n: number; p25: number; median: number; p75: number; min: number; max: number };
  position?: 'LOW' | 'IN_RANGE' | 'HIGH' | null;
  comment?: string;
  meta: AiMeta | null;
}

export interface MilestoneDraft {
  milestones: { title: string; amount: number }[];
  totalAmount: number;
  note: string;
  meta: AiMeta;
}

export interface DisputeSummary {
  summary: { summary: string; clientPoints: string[]; expertPoints: string[]; checkpoints: string[] };
  meta: AiMeta;
}

export interface ExpertRecommendation {
  expertId: string;
  expertName: string | null;
  label: string | null;
  alreadyApplied: boolean;
  completedInDomain: number;
  totalScore: number;
  breakdown: Record<'reputation' | 'certification' | 'topicFit' | 'experience', { points: number; max: number; note: string }>;
}

export interface BountyRecommendation {
  bountyId: string;
  title: string;
  domainType: string;
  amount: number;
  applicantCount: number;
  totalScore: number;
  breakdown: Record<'domain' | 'topicFit' | 'freshness' | 'competition', { points: number; max: number; note: string }>;
}

export interface MatchResult<T> {
  recommendations: T[];
  meta: AiMeta | null;
  note: string | null;
}

export const REVIEW_KEYWORDS = {
  positive: ['응답이 빨랐어요', '결과가 정확했어요', '설명이 친절했어요', '요구사항을 모두 충족했어요', '기한을 지켰어요', '가격이 합리적이었어요'],
  negative: ['소통이 아쉬웠어요', '일정이 늦어졌어요', '결과 보완이 필요했어요', '설명이 부족했어요'],
} as const;

export interface ReviewDraftResponse {
  note: string;
  meta: AiMeta;
}

export interface ReviewPoint {
  point: string;
  quote: string;
}

export interface ReviewSummaryResponse {
  enoughData: boolean;
  sampleCount: number;
  message: string | null;
  summary: {
    summary: string;
    strengths: ReviewPoint[];
    concerns: ReviewPoint[];
    basedOn: number;
    averageRating: number;
  } | null;
  meta: AiMeta | null;
}

export type RiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
export type RiskType = 'OFF_PLATFORM' | 'CONTACT' | 'ADVANCE_PAYMENT' | 'CREDENTIALS' | 'GUARANTEE' | 'PRESSURE';

export interface RiskSignal {
  type: RiskType;
  quote: string;
  why: string;
  source: 'RULE' | 'AI';
}

export interface RiskCheckResponse {
  level: RiskLevel;
  signals: RiskSignal[];
  checkedChars: number;
  meta: AiMeta | null;
}

export interface BountyDraftResponse {
  draft: {
    domainType: string | null;
    title: string;
    description: string;
    missing: string[];
  };
  priceHint: { n: number; p25: number; median: number; p75: number } | null;
  meta: AiMeta;
}
