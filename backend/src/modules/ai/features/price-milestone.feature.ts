import { clampText, numbersGrounded, percentile, wrapUserData } from '../ai-guards';

/** 기능 5: 가격 참고 (통계는 서버가 계산, AI는 해설만) */
export interface PriceStats {
  n: number;
  p25: number;
  median: number;
  p75: number;
  min: number;
  max: number;
}

export const MIN_SAMPLES = 3;

export function computeStats(amounts: number[]): PriceStats | null {
  if (amounts.length < MIN_SAMPLES) return null;
  const s = [...amounts].sort((a, b) => a - b);
  return {
    n: s.length,
    p25: percentile(s, 0.25),
    median: percentile(s, 0.5),
    p75: percentile(s, 0.75),
    min: s[0],
    max: s[s.length - 1],
  };
}

export function positionOf(amount: number, st: PriceStats): 'LOW' | 'IN_RANGE' | 'HIGH' {
  if (amount < st.p25) return 'LOW';
  if (amount > st.p75) return 'HIGH';
  return 'IN_RANGE';
}

export const PRICE_INSTRUCTIONS = [
  '같은 분야에서 정산 완료된 프로젝트 금액 통계와 이 공고의 금액을 비교해 2문장 이내로 해설합니다.',
  '통계에 없는 숫자를 만들지 않습니다. 금액이 적정한지 단정하지 말고 "참고 범위"라고 표현합니다.',
  '출력 형식: {"comment":"..."}',
].join('\n');

export function buildPricePrompt(st: PriceStats, amount: number | null, title: string, description: string) {
  return [
    `정산 완료 사례 ${st.n}건: 하위 25% ${st.p25}원, 중앙값 ${st.median}원, 상위 25% ${st.p75}원, 최소 ${st.min}원, 최대 ${st.max}원`,
    amount ? `이 공고 금액: ${amount}원` : '이 공고 금액: 미정',
    wrapUserData('공고 제목', title, 200),
    wrapUserData('공고 설명', description, 1500),
  ].join('\n');
}

export function validatePriceComment(json: unknown, st: PriceStats, amount: number | null): string | null {
  const comment = clampText((json as any)?.comment, 400);
  if (!comment) return null;
  const corpus = [st.n, st.p25, st.median, st.p75, st.min, st.max, amount ?? ''].join(' ');
  return numbersGrounded(comment, corpus) ? comment : null;
}

export function ruleBasedPriceComment(st: PriceStats, amount: number | null): string {
  const base = `같은 분야 정산 사례 ${st.n}건의 중앙값은 ${st.median}원, 중간 50% 범위는 ${st.p25}원~${st.p75}원입니다.`;
  if (!amount) return base;
  const pos = positionOf(amount, st);
  const word = pos === 'LOW' ? '참고 범위보다 낮은 편' : pos === 'HIGH' ? '참고 범위보다 높은 편' : '참고 범위 안';
  return `${base} 이 공고 금액 ${amount}원은 ${word}입니다.`;
}

/** 기능 6: 마일스톤 초안. AI는 단계 이름과 비율만 제안하고, 금액은 서버가 계산한다. */
export interface MilestoneDraftItem {
  title: string;
  amount: number;
}

export const MILESTONE_INSTRUCTIONS = [
  '프로젝트를 2~5개의 검수 가능한 단계로 나눕니다. 각 단계는 제출물이 분명해야 합니다.',
  '금액은 정하지 않고 비중(ratio, 양의 정수)만 제안합니다.',
  '출력 형식: {"milestones":[{"title":"40자 이내","ratio":30}]}',
].join('\n');

export function buildMilestonePrompt(title: string, description: string, requirements: string[]) {
  return [
    wrapUserData('공고 제목', title, 200),
    wrapUserData('공고 설명', description, 3000),
    wrapUserData('확정된 요구사항', requirements.join('\n') || '(없음)', 1500),
  ].join('\n');
}

export const MIN_MILESTONE_AMOUNT = 1000;

/** 비율로 금액을 나누되 합이 정확히 총액이 되게 하고, 각 금액은 최소 1,000원을 지킨다. */
export function allocateAmounts(total: number, ratios: number[]): number[] | null {
  const n = ratios.length;
  if (n < 2 || total < MIN_MILESTONE_AMOUNT * n) return null;
  if (ratios.some((r) => !Number.isFinite(r) || r <= 0)) return null;
  const sum = ratios.reduce((a, b) => a + b, 0);
  const spare = total - MIN_MILESTONE_AMOUNT * n;
  const raw = ratios.map((r) => (spare * r) / sum);
  const floors = raw.map((x) => Math.floor(x));
  let rest = spare - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; rest > 0; k = (k + 1) % n, rest--) floors[order[k].i] += 1;
  return floors.map((f) => f + MIN_MILESTONE_AMOUNT);
}

export function validateMilestones(json: unknown, total: number): MilestoneDraftItem[] | null {
  const ms = (json as any)?.milestones;
  if (!Array.isArray(ms) || ms.length < 2 || ms.length > 6) return null;
  const titles: string[] = [];
  const ratios: number[] = [];
  for (const m of ms) {
    const t = clampText(m?.title, 40);
    const r = Number(m?.ratio);
    if (!t || !Number.isInteger(r) || r <= 0) return null;
    titles.push(t);
    ratios.push(r);
  }
  const amounts = allocateAmounts(total, ratios);
  if (!amounts) return null;
  return titles.map((title, i) => ({ title, amount: amounts[i] }));
}

export function ruleBasedMilestones(total: number): MilestoneDraftItem[] | null {
  const plans: [string, number][] = [['착수 및 분석 결과 제출', 30], ['중간 산출물 제출', 40], ['최종 결과물 제출', 30]];
  let use = plans;
  if (total < MIN_MILESTONE_AMOUNT * 3) use = [plans[0], plans[2]];
  const amounts = allocateAmounts(total, use.map((p) => p[1]));
  if (!amounts) return null;
  return use.map((p, i) => ({ title: p[0], amount: amounts[i] }));
}
