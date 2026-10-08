import { clampText, numbersGrounded, quoteInSource, wrapUserData } from '../ai-guards';

/**
 * 기능 9·10: 후기 — (1) 의뢰인의 후기 작성 도우미, (2) 전문가 프로필의 후기 요약.
 *
 * 원칙: AI는 의뢰인이 고른 점수·키워드와 시스템에 기록된 사실(처리 기간, 제출 횟수, 분쟁 여부)만 문장으로
 * 옮긴다. 점수를 정하거나 없는 경험을 지어내지 않고, 최종 문장은 의뢰인이 고쳐서 직접 제출한다.
 * 요약은 실제 후기 문장에서 그대로 따온 인용(quote)이 있는 항목만 통과시킨다.
 */

// ───────── (1) 후기 작성 도우미 ─────────

export const REVIEW_KEYWORDS = {
  positive: ['응답이 빨랐어요', '결과가 정확했어요', '설명이 친절했어요', '요구사항을 모두 충족했어요', '기한을 지켰어요', '가격이 합리적이었어요'],
  negative: ['소통이 아쉬웠어요', '일정이 늦어졌어요', '결과 보완이 필요했어요', '설명이 부족했어요'],
} as const;
export const ALL_REVIEW_KEYWORDS: string[] = [...REVIEW_KEYWORDS.positive, ...REVIEW_KEYWORDS.negative];

export interface ReviewFacts {
  domainLabel: string;
  durationDays: number;
  submissionCount: number;
  wentThroughDispute: boolean;
  rating: number; // 의뢰인이 직접 고른 점수
  keywords: string[];
  hint: string; // 의뢰인이 적은 한마디(없으면 빈 문자열)
}

export const REVIEW_DRAFT_INSTRUCTIONS = [
  '의뢰인이 전문가에게 남길 후기 초안을 한국어로 씁니다. 의뢰인 본인의 말투(존댓말, 1인칭)로, 2~4문장, 250자 이내로 씁니다.',
  '점수와 어울리는 톤으로 씁니다. 점수가 낮으면 칭찬으로 포장하지 않고, 높으면 불필요하게 깎아내리지 않습니다.',
  '의뢰인의 앞으로의 의향(다시 이용하겠다, 추천하겠다 등)은 입력에 없으면 쓰지 않습니다. 의뢰인 대신 약속하는 문장을 만들지 않습니다.',
  '사용할 수 있는 근거는 입력으로 받은 키워드·한마디·기록된 사실(처리 기간, 제출 횟수, 분쟁 여부)뿐입니다. 그 밖의 경험, 이름, 연락처, 금액은 지어내지 않습니다.',
  '출력 형식: {"note":"후기 문장"}',
].join('\n');

export function buildReviewDraftPrompt(f: ReviewFacts): string {
  return [
    `분야: ${f.domainLabel}`,
    `의뢰인이 고른 점수: ${f.rating.toFixed(1)} / 10`,
    `처리 기간: ${f.durationDays}일, 결과물 제출 ${f.submissionCount}회, 분쟁 ${f.wentThroughDispute ? '있었음' : '없었음'}`,
    wrapUserData('선택한 키워드', f.keywords.join(', ') || '(없음)', 400),
    wrapUserData('의뢰인 한마디', f.hint || '(없음)', 200),
  ].join('\n');
}

export function reviewDraftCorpus(f: ReviewFacts): string {
  return [f.domainLabel, f.rating.toFixed(1), String(f.durationDays), String(f.submissionCount), ...f.keywords, f.hint].join('\n');
}

const PRIVATE_INFO = /(\d{2,3}-?\d{3,4}-?\d{4})|([\w.+-]+@[\w-]+\.[\w.-]+)|(https?:\/\/)/i;

export function validateReviewDraft(json: unknown, corpus: string): string | null {
  const note = clampText((json as any)?.note, 300);
  if (!note || note.length < 10) return null;
  if (PRIVATE_INFO.test(note)) return null;
  if (!numbersGrounded(note, corpus)) return null;
  return note;
}

/** 규칙 기반: 고른 키워드를 점수 톤에 맞춰 이어 붙인다. */
export function ruleBasedReviewDraft(f: ReviewFacts): string {
  const pos = f.keywords.filter((k) => (REVIEW_KEYWORDS.positive as readonly string[]).includes(k));
  const neg = f.keywords.filter((k) => (REVIEW_KEYWORDS.negative as readonly string[]).includes(k));
  const parts: string[] = [];
  if (f.rating >= 8) parts.push(`${f.domainLabel} 건을 만족스럽게 마쳤습니다.`);
  else if (f.rating >= 5) parts.push(`${f.domainLabel} 건을 무난하게 마쳤습니다.`);
  else parts.push(`${f.domainLabel} 건은 기대에 미치지 못했습니다.`);
  if (pos.length) parts.push(`${pos.slice(0, 3).join(', ')}.`);
  if (neg.length) parts.push(`다만 ${neg.slice(0, 2).join(', ')}.`);
  if (f.hint) parts.push(f.hint.slice(0, 80));
  parts.push(`처리에는 ${f.durationDays}일이 걸렸습니다.`);
  return parts.join(' ').slice(0, 300);
}

// ───────── (2) 전문가 후기 요약 ─────────

export interface ReviewItem {
  rating: number;
  note: string;
}

export interface ReviewPoint {
  point: string;
  quote: string;
}

export interface ReviewSummary {
  summary: string;
  strengths: ReviewPoint[];
  concerns: ReviewPoint[];
  basedOn: number; // 요약에 쓰인 후기(문장이 있는 것) 수
  averageRating: number;
}

export const REVIEW_SUMMARY_MIN = 3;

export const REVIEW_SUMMARY_INSTRUCTIONS = [
  '한 전문가에게 달린 의뢰인 후기들을 요약합니다. 후기에 적힌 내용만 사용하고, 후기에 없는 장점이나 단점은 쓰지 않습니다.',
  'strengths(자주 칭찬받은 점)와 concerns(아쉽다고 한 점)는 각각 최대 3개이며, 각 항목에는 근거가 된 후기 문장 일부를 quote에 그대로(글자 하나 바꾸지 않고) 옮겨 적습니다.',
  '아쉬운 점이 후기에 없으면 concerns는 빈 배열로 둡니다. 전문가를 평가하거나 추천/비추천하는 말은 하지 않습니다.',
  '출력 형식: {"summary":"150자 이내 요약","strengths":[{"point":"...","quote":"..."}],"concerns":[{"point":"...","quote":"..."}]}',
].join('\n');

export function buildReviewSummaryPrompt(items: ReviewItem[]): string {
  return items.map((r, i) => wrapUserData(`후기 ${i + 1} 점수 ${r.rating.toFixed(1)}`, r.note, 300)).join('\n');
}

export function reviewSummaryCorpus(items: ReviewItem[]): string {
  return items.map((r) => `${r.rating.toFixed(1)}\n${r.note}`).join('\n');
}

export function validateReviewSummary(json: unknown, items: ReviewItem[]): ReviewSummary | null {
  const j: any = json;
  const source = items.map((r) => r.note).join('\n');
  const corpus = reviewSummaryCorpus(items) + `\n${items.length}`;
  const summary = clampText(j?.summary, 200);
  if (!summary) return null;
  const points = (v: unknown): ReviewPoint[] | null => {
    if (!Array.isArray(v)) return null;
    const out: ReviewPoint[] = [];
    for (const x of v.slice(0, 3)) {
      const point = clampText((x as any)?.point, 80);
      const quote = clampText((x as any)?.quote, 150);
      if (!point || !quote || !quoteInSource(quote, source)) continue; // 근거 없는 항목은 버린다
      out.push({ point, quote });
    }
    return out;
  };
  const strengths = points(j?.strengths);
  const concerns = points(j?.concerns);
  if (!strengths || !concerns) return null;
  if (strengths.length === 0 && concerns.length === 0) return null;
  if (!numbersGrounded([summary, ...strengths.map((s) => s.point), ...concerns.map((c) => c.point)].join('\n'), corpus)) return null;
  return { summary, strengths, concerns, basedOn: items.length, averageRating: average(items) };
}

function average(items: ReviewItem[]): number {
  return Math.round((items.reduce((s, r) => s + r.rating, 0) / items.length) * 10) / 10;
}

/** 규칙 기반: 평균 점수와 가장 높은/낮은 점수의 후기 문장을 그대로 보여준다. */
export function ruleBasedReviewSummary(items: ReviewItem[]): ReviewSummary {
  const sorted = [...items].sort((a, b) => b.rating - a.rating);
  const avg = average(items);
  const top = sorted.slice(0, 2).filter((r) => r.rating >= 7);
  const low = sorted.slice(-2).filter((r) => r.rating <= 6);
  return {
    summary: `후기 ${items.length}건의 평균 점수는 ${avg.toFixed(1)}점입니다. 아래는 점수가 높은 후기와 낮은 후기를 그대로 옮긴 것입니다.`,
    strengths: top.map((r) => ({ point: `${r.rating.toFixed(1)}점 후기`, quote: r.note.slice(0, 150) })),
    concerns: low.map((r) => ({ point: `${r.rating.toFixed(1)}점 후기`, quote: r.note.slice(0, 150) })),
    basedOn: items.length,
    averageRating: avg,
  };
}
