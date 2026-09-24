import { Injectable } from '@nestjs/common';
import { BountiesService } from '../bounties/bounties.service';
import { CertificationsService } from '../certifications/certifications.service';
import { UsersService } from '../users/users.service';
import { Bounty } from '../bounties/entities/bounty.entity';
import { BountyStatus } from '../../common/enums/bounty-status.enum';
import { DomainType, DOMAIN_LABELS } from '../../common/enums/domain-type.enum';
import { VerificationStatus } from '../../common/enums/verification-track.enum';

/**
 * =========================================================================
 * AiInsightsService — "AI 기반 개인화 예산/소비패턴 분석" + "AI & 마이데이터 기반
 * 개인화 금융관리" (기획서 상단 두 개 부제 주제)를 구현하는 자리.
 * =========================================================================
 *
 * [MOCK 고지] 이 프로젝트는 처음부터 "Mock 서비스로 전체 흐름을 먼저 완성하고,
 * 나중에 외부 연동으로 교체한다"는 원칙을 따른다 (MockVerificationService,
 * MockPaymentGatewayService, MockEscrowService 등과 동일한 패턴).
 * generateInsights()가 지금은 규칙 기반(rule-based) 템플릿 문장을 만들어내지만,
 * 입력(가공된 통계 데이터)과 출력(문자열 배열) 인터페이스는 실제 LLM API 호출로
 * 그대로 교체 가능하도록 설계했다 — 나중에 이 메서드 내부만 "OpenAI/Claude에 통계를
 * 프롬프트로 넘겨 문장을 받아온다"로 바꾸면 컨트롤러/프론트는 변경할 필요가 없다.
 *
 * 마이데이터(MyData) 연동도 마찬가지 원칙: 실제 마이데이터 API 대신 우리 플랫폼
 * 자체에 쌓인 프로젝트/거래 이력을 "내 지출·수입 데이터"로 취급해 분석한다 —
 * 사용자 입장에서는 "내 활동 데이터 기반 맞춤 분석"이라는 동일한 가치를 제공한다.
 *
 * 아래 3개 기능은 "AI 해석" 또는 "마이데이터 연결" 둘 중 하나에 반드시 해당해야만
 * 추가한다는 기준으로 고른 것들이다 (검토 과정에서 "인증-수익 연결 추천" 아이디어는
 * 이 기준에 억지로 끼워맞춘 것에 가깝다고 판단해 제외했다):
 *   1) 예산 목표 대비 소비 인사이트 (주제1)
 *   2) 소비 이상탐지 하이라이트 (주제1)
 *   3) 다음 달 지출/수익 예측 (주제1+2)
 */

export interface DomainBreakdownItem {
  domainType: DomainType;
  domainLabel: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface MonthlyTrendItem {
  month: string; // 'YYYY-MM'
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

const ACTIVE_SPEND_STATUSES = new Set([
  BountyStatus.LOCKED,
  BountyStatus.SUBMITTED,
  BountyStatus.SETTLED,
  BountyStatus.DISPUTED,
]);

// 이상탐지를 "급증"으로 판단할 최소 증가율
const ANOMALY_THRESHOLD_PCT = 30;

@Injectable()
export class AiInsightsService {
  constructor(
    private readonly bountiesService: BountiesService,
    private readonly certificationsService: CertificationsService,
    private readonly usersService: UsersService,
  ) {}

  async getMyInsights(userId: string): Promise<MyInsightsResponse> {
    const user = await this.usersService.findById(userId);
    const [bounties, certifications] = await Promise.all([
      this.bountiesService.findMine(userId, 500),
      this.certificationsService.findMine(userId),
    ]);

    const asClient = bounties.filter((b) => b.clientId === userId);
    const asExpert = bounties.filter((b) => b.assignedExpertId === userId);

    const spentBounties = asClient.filter((b) => ACTIVE_SPEND_STATUSES.has(b.status));
    const earnedBounties = asExpert.filter((b) => b.status === BountyStatus.SETTLED);

    const totalSpent = sumAmount(spentBounties);
    const totalEarned = sumAmount(earnedBounties);

    const spendingByDomain = groupByDomain(spentBounties, totalSpent);
    const earningByDomain = groupByDomain(earnedBounties, totalEarned);

    const months = getRecentMonths(6);
    const monthlyTrend = buildMonthlyTrend(months, spentBounties, earnedBounties);

    const summary = {
      totalSpent,
      totalEarned,
      activeAsClient: asClient.filter(
        (b) => b.status === BountyStatus.PENDING || b.status === BountyStatus.LOCKED,
      ).length,
      activeAsExpert: asExpert.filter(
        (b) => b.status === BountyStatus.LOCKED || b.status === BountyStatus.SUBMITTED,
      ).length,
      settledCount: bounties.filter((b) => b.status === BountyStatus.SETTLED).length,
      disputedCount: bounties.filter((b) => b.status === BountyStatus.DISPUTED).length,
      approvedCertificationCount: certifications.filter(
        (c) => c.verifiedStatus === VerificationStatus.APPROVED,
      ).length,
    };

    // 기능1: 예산 목표 대비 소비
    const thisMonthSpent = monthlyTrend[monthlyTrend.length - 1]?.spent ?? 0;
    const goal = user?.monthlyBudgetGoal != null ? Number(user.monthlyBudgetGoal) : null;
    const budget: BudgetInsight = {
      goal,
      thisMonthSpent,
      usageRate: goal && goal > 0 ? Math.round((thisMonthSpent / goal) * 1000) / 10 : null,
    };

    // 기능2: 소비 이상탐지 하이라이트
    const spendingAnomaly = detectSpendingAnomaly(spentBounties, months);

    // 기능3: 다음 달 지출/수익 예측
    const forecast = forecastNextMonth(monthlyTrend);

    const insights = generateInsights({
      role: user?.role ?? 'CLIENT',
      summary,
      spendingByDomain,
      earningByDomain,
      monthlyTrend,
      budget,
      spendingAnomaly,
      forecast,
    });

    return {
      role: (user?.role as MyInsightsResponse['role']) ?? 'CLIENT',
      summary,
      spendingByDomain,
      earningByDomain,
      monthlyTrend,
      budget,
      spendingAnomaly,
      forecast,
      insights,
    };
  }
}

function sumAmount(bounties: Bounty[]): number {
  return bounties.reduce((acc, b) => acc + Number(b.bountyAmount), 0);
}

function groupByDomain(bounties: Bounty[], total: number): DomainBreakdownItem[] {
  const map = new Map<DomainType, { amount: number; count: number }>();
  for (const b of bounties) {
    const cur = map.get(b.domainType) ?? { amount: 0, count: 0 };
    cur.amount += Number(b.bountyAmount);
    cur.count += 1;
    map.set(b.domainType, cur);
  }
  return Array.from(map.entries())
    .map(([domainType, v]) => ({
      domainType,
      domainLabel: DOMAIN_LABELS[domainType],
      amount: v.amount,
      count: v.count,
      percentage: total > 0 ? Math.round((v.amount / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** 이번 달을 포함해 최근 n개월의 'YYYY-MM' 축을 오래된 순으로 만든다. */
function getRecentMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(monthKey(d));
  }
  return months;
}

function buildMonthlyTrend(months: string[], spent: Bounty[], earned: Bounty[]): MonthlyTrendItem[] {
  const spentMap = new Map<string, number>();
  for (const b of spent) {
    const key = monthKey(new Date(b.updatedAt));
    spentMap.set(key, (spentMap.get(key) ?? 0) + Number(b.bountyAmount));
  }
  const earnedMap = new Map<string, number>();
  for (const b of earned) {
    const key = monthKey(new Date(b.updatedAt));
    earnedMap.set(key, (earnedMap.get(key) ?? 0) + Number(b.bountyAmount));
  }

  return months.map((month) => ({
    month,
    spent: spentMap.get(month) ?? 0,
    earned: earnedMap.get(month) ?? 0,
  }));
}

/**
 * 기능2: 이번 달 도메인별 지출을, 그 도메인의 직전 3개월 평균 지출과 비교한다.
 * 직전 평균이 0원인 도메인(=이번 달 처음 지출한 도메인)은 "급증"이 아니라
 * "신규"이므로 제외한다 - 그래야 노이즈 없이 진짜 이상 패턴만 잡아낸다.
 */
function detectSpendingAnomaly(spent: Bounty[], months: string[]): SpendingAnomaly | null {
  if (months.length < 4) return null;
  const thisMonth = months[months.length - 1];
  const prevMonths = months.slice(-4, -1);

  const domainMonthMap = new Map<DomainType, Map<string, number>>();
  for (const b of spent) {
    const key = monthKey(new Date(b.updatedAt));
    if (!months.includes(key)) continue;
    const domainMap = domainMonthMap.get(b.domainType) ?? new Map<string, number>();
    domainMap.set(key, (domainMap.get(key) ?? 0) + Number(b.bountyAmount));
    domainMonthMap.set(b.domainType, domainMap);
  }

  let best: SpendingAnomaly | null = null;
  for (const [domainType, monthMap] of domainMonthMap.entries()) {
    const thisAmt = monthMap.get(thisMonth) ?? 0;
    if (thisAmt <= 0) continue;
    const prevAvg = prevMonths.reduce((acc, m) => acc + (monthMap.get(m) ?? 0), 0) / prevMonths.length;
    if (prevAvg <= 0) continue;

    const increasePct = Math.round(((thisAmt - prevAvg) / prevAvg) * 100);
    if (increasePct >= ANOMALY_THRESHOLD_PCT && (!best || increasePct > best.increasePct)) {
      best = {
        domainType,
        domainLabel: DOMAIN_LABELS[domainType],
        thisMonthAmount: thisAmt,
        avgPrevAmount: Math.round(prevAvg),
        increasePct,
      };
    }
  }
  return best;
}

/**
 * 기능3: 최근 3개월 지출/수익에 가중치(오래된 달일수록 낮게)를 둔 가중평균으로
 * 다음 달을 예측한다. 실제 시계열 예측 모델 대신 쓰는 [MOCK] 단순 추정치이며,
 * 다른 규칙 기반 로직들과 같은 이유로 나중에 실제 예측 모델로 교체 가능하다.
 */
function forecastNextMonth(monthlyTrend: MonthlyTrendItem[]): NextMonthForecast | null {
  if (monthlyTrend.length < 3) return null;
  const last3 = monthlyTrend.slice(-3); // [3개월 전, 2개월 전, 지난달] 순
  const weights = [0.2, 0.3, 0.5];

  const nextMonthSpent = Math.round(
    last3.reduce((acc, m, i) => acc + m.spent * weights[i], 0),
  );
  const nextMonthEarned = Math.round(
    last3.reduce((acc, m, i) => acc + m.earned * weights[i], 0),
  );
  return { nextMonthSpent, nextMonthEarned };
}

/**
 * [MOCK] 규칙 기반 자연어 인사이트 생성.
 * 실제 LLM 연동 시: 이 함수의 인자(집계된 통계)를 그대로 프롬프트 컨텍스트로 넘기고,
 * 반환값(string[])만 LLM 응답 파싱 결과로 바꾸면 된다. 호출부(getMyInsights)와
 * 프론트엔드는 수정할 필요가 없다.
 */
function generateInsights(input: {
  role: string;
  summary: MyInsightsResponse['summary'];
  spendingByDomain: DomainBreakdownItem[];
  earningByDomain: DomainBreakdownItem[];
  monthlyTrend: MonthlyTrendItem[];
  budget: BudgetInsight;
  spendingAnomaly: SpendingAnomaly | null;
  forecast: NextMonthForecast | null;
}): string[] {
  const { summary, spendingByDomain, earningByDomain, monthlyTrend, budget, spendingAnomaly, forecast } = input;
  const insights: string[] = [];

  if (spendingByDomain.length > 0) {
    const top = spendingByDomain[0];
    insights.push(
      `최근 지출이 가장 많은 분야는 '${top.domainLabel}'로, 전체 지출의 ${top.percentage}%(${formatWon(
        top.amount,
      )})를 차지하고 있어요.`,
    );
  }
  if (earningByDomain.length > 0) {
    const top = earningByDomain[0];
    insights.push(
      `정산 완료 기준으로 가장 많이 수익을 낸 분야는 '${top.domainLabel}'이에요 (${formatWon(top.amount)}).`,
    );
  }

  // 기능1: 예산 목표 대비 소비
  if (budget.goal && budget.usageRate != null) {
    if (budget.usageRate >= 100) {
      insights.push(
        `이번 달 지출이 설정하신 예산 ${formatWon(budget.goal)}을 ${formatWon(
          budget.thisMonthSpent - budget.goal,
        )} 초과했어요. 다음 지출은 한 번 더 점검해보세요.`,
      );
    } else if (budget.usageRate >= 80) {
      insights.push(
        `이번 달 예산 ${formatWon(budget.goal)} 중 ${budget.usageRate}%를 이미 사용했어요. 남은 예산은 ${formatWon(
          budget.goal - budget.thisMonthSpent,
        )}이에요.`,
      );
    } else {
      insights.push(
        `이번 달 예산 ${formatWon(budget.goal)} 중 ${budget.usageRate}%를 사용했어요. 여유있게 관리되고 있어요.`,
      );
    }
  }

  // 기능2: 소비 이상탐지
  if (spendingAnomaly) {
    insights.push(
      `이번 달 '${spendingAnomaly.domainLabel}' 지출이 최근 3개월 평균(${formatWon(
        spendingAnomaly.avgPrevAmount,
      )}) 대비 ${spendingAnomaly.increasePct}% 늘어난 ${formatWon(
        spendingAnomaly.thisMonthAmount,
      )}이에요. 갑자기 늘어난 이유를 한 번 점검해보세요.`,
    );
  }

  const last3 = monthlyTrend.slice(-3);
  const last3Spent = last3.reduce((acc, m) => acc + m.spent, 0);
  const prev3 = monthlyTrend.slice(-6, -3);
  const prev3Spent = prev3.reduce((acc, m) => acc + m.spent, 0);
  if (prev3Spent > 0) {
    const diffPct = Math.round(((last3Spent - prev3Spent) / prev3Spent) * 100);
    if (Math.abs(diffPct) >= 5) {
      insights.push(
        diffPct > 0
          ? `최근 3개월 지출이 이전 3개월 대비 ${diffPct}% 늘었어요. 예산 계획을 한 번 점검해보는 게 좋겠어요.`
          : `최근 3개월 지출이 이전 3개월 대비 ${Math.abs(diffPct)}% 줄었어요. 지출 관리가 잘 되고 있어요.`,
      );
    }
  } else if (last3Spent > 0) {
    insights.push(`최근 3개월 동안 ${formatWon(last3Spent)}을 지출했어요.`);
  }

  // 기능3: 다음 달 예측
  if (forecast) {
    insights.push(
      `최근 3개월 추세로 보면, 다음 달엔 약 ${formatWon(forecast.nextMonthSpent)}을 지출하고 약 ${formatWon(
        forecast.nextMonthEarned,
      )}을 수익낼 것으로 예상돼요.`,
    );
  }

  if (summary.disputedCount > 0) {
    insights.push(
      `현재 이의제기 중인 건이 ${summary.disputedCount}건 있어요. 마이페이지에서 진행 상황을 확인해보세요.`,
    );
  }
  if (summary.approvedCertificationCount > 0 && earningByDomain.length === 0) {
    insights.push(
      `보유하신 자격 인증 ${summary.approvedCertificationCount}건에 맞는 프로젝트에 아직 지원 이력이 없어요. 관련 분야 프로젝트를 둘러보세요.`,
    );
  }

  if (insights.length === 0) {
    insights.push('아직 분석할 활동 데이터가 충분하지 않아요. 프로젝트를 등록하거나 지원해보면 맞춤 인사이트를 받아볼 수 있어요.');
  }

  return insights;
}

function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}
