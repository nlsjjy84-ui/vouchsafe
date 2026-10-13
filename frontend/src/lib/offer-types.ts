import { DomainType, ServiceType } from './types';

export interface OfferCard {
  id: string;
  domainType: DomainType;
  domainLabel: string;
  title: string;
  excerpt: string;
  price: number;
  fee: number;
  serviceType: ServiceType;
  area: string | null;
  days: number;
  status: 'ACTIVE' | 'CLOSED';
  orderCount: number;
  messageCount: number;
  expert: { id: string; name: string };
  /** 그 분야를 어떤 길로 인증했는지 (국가 공인 자격증 등). 자격증 번호 원문은 오지 않는다. */
  verification: { track: string; label: string } | null;
  images: string[];
  /** 상품 후기 평균(10점 만점) — 이 상품으로 정산이 끝난 의뢰인 평가만 */
  rating: { avg: number; count: number } | null;
  /** 이 사이트에서 같은 분야로 실제 의뢰된 금액 평균(3건 이상일 때만) */
  domainAverage: number | null;
  domainAverageCount: number;
  createdAt: string;
}

export interface OfferListResponse {
  stats: {
    activeOffers: number;
    experts: number;
    medianPrice: number | null;
    orders: number;
    questions: number;
    byDomain: { domainType: DomainType; label: string; count: number }[];
  };
  trust: { verifiedExperts: number; reviewed: number; approved: number; rejected: number; pending: number; passRate: number | null; settledDeals: number; refundedDeals: number; byTrack: { track: string; label: string; experts: number }[] };
  items: OfferCard[];
}

export interface OfferMessage {
  id: string;
  content: string;
  /** 신고 처리로 관리자가 가린 문의 */
  hidden: boolean;
  createdAt: string;
  author: { id: string; name: string };
  isExpert: boolean;
}

export interface OfferReview {
  id: string;
  rating: number;
  note: string | null;
  author: string;
  settledAt: string;
}

export interface OfferDetail extends OfferCard {
  description: string;
  expertCompleted: number;
  /** 이 전문가가 모든 거래에서 받은 의뢰인 평가 */
  expertRating: { avg: number; count: number } | null;
  reviews: OfferReview[];
  messages: OfferMessage[];
}

export interface MyOffersResponse {
  summary: { active: number; closed: number; questions: number; orders: number; maxActive: number };
  items: OfferCard[];
}

/**
 * 플랫폼 수수료(누진식): 구간 시작 수수료 + 1만 원 올라갈 때마다 추가금. 전문가 부담, 의뢰인 0원.
 * 백엔드 mocks/settlement-fee.util.ts 와 같은 표 — 프론트/백엔드가 코드를 공유하지 않아 값만 맞춘다.
 */
export const FEE_STEPS = [
  { from: 100_000, start: 15_000, per10k: 1_500 },
  { from: 200_000, start: 30_000, per10k: 1_200 },
  { from: 300_000, start: 42_000, per10k: 1_000 },
  { from: 500_000, start: 62_000, per10k: 800 },
  { from: 1_000_000, start: 102_000, per10k: 600 },
  { from: 5_000_000, start: 342_000, per10k: 500 },
];
export const MIN_DEAL = 100_000;

export function platformFee(amount: number): number {
  if (!amount || amount <= 0) return 0;
  const tenK = Math.floor(amount / 10_000) * 10_000;
  if (tenK < FEE_STEPS[0].from) return Math.min(amount, (tenK / 10_000) * FEE_STEPS[0].per10k);
  let step = FEE_STEPS[0];
  for (const s of FEE_STEPS) if (tenK >= s.from) step = s;
  return Math.min(amount, step.start + ((tenK - step.from) / 10_000) * step.per10k);
}

export const FEE_RULE_TEXT = '10만 원 1만 5천 원부터, 1만 원 올라갈 때마다 1,500원 → 금액이 클수록 500원까지 줄어듦';

export const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
export const manwon = (n: number) => (n >= 10_000 ? `${(n / 10_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만 원` : won(n));
