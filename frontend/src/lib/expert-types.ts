import { DomainType } from './types';

export type ExpertOutcome = 'SUCCESS' | 'SUCCESS_AFTER_DISPUTE' | 'REFUNDED' | 'ON_HOLD';

/** GET /experts/:id/profile - 로그인 없이 볼 수 있는 전문가 공개 프로필 */
export interface ExpertProfile {
  id: string;
  name: string;
  role: 'EXPERT' | 'HYBRID';
  joinedAt: string;
  region: { text: string; sido: string | null; sigungu: string | null; dong: string | null } | null;
  verifiedDomains: { domainType: DomainType; domainLabel: string; track: string; verifiedSince: string; completed: number }[];
  reputation: {
    score10: number;
    hasEnoughData: boolean;
    completedCount: number;
    refundedCount: number;
    disputedCount: number;
    completionRate: number;
    disputeWinCount: number;
    disputeTotalCount: number;
    avgSettlementDays: number | null;
  };
  outcomes: { success: number; successAfterDispute: number; refunded: number; onHold: number };
  avgClientRating: number | null;
  ratedCount: number;
  reviews: { id: string; domainLabel: string; rating: number; note: string | null; outcome: ExpertOutcome; settledAt: string }[];
  recentCases: {
    id: string;
    domainType: DomainType;
    domainLabel: string;
    outcome: ExpertOutcome;
    durationDays: number;
    amountBand: string;
    clientRating: number | null;
    clientRatingNote: string | null;
    settledAt: string;
  }[];
}
