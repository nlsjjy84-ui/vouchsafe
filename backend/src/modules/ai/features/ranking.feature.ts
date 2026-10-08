import { clampText, wrapUserData } from '../ai-guards';

/**
 * 기능 2: 지원자 추천 정렬 (점수 0~100, 선택은 의뢰인이 한다)
 *   평판 45 + 인증 25 + 메시지 적합도 20 + 메시지 성의 10
 * 평판/인증/성의는 서버가 계산한다(AI가 건드리지 못함). AI는 "메시지 적합도 0~20"과 한 줄 근거만 낸다.
 * AI에는 이름 대신 '지원자 A/B/C' 라벨만 보낸다(개인 식별 정보 최소화, 이름 편향 차단).
 */
export const RANKING_INSTRUCTIONS = [
  '공고 내용과 각 지원자의 지원 메시지를 비교해 "메시지가 공고 요구와 얼마나 맞는지"만 0~20 정수로 평가합니다.',
  '경력, 평판, 인증은 평가하지 않습니다(다른 곳에서 계산됨). 메시지에 적힌 내용만 근거로 삼습니다.',
  '출력 형식: {"fits":[{"label":"지원자 A","score":0,"reason":"80자 이내 근거"}]}',
].join('\n');

export const labelOf = (index: number) => `지원자 ${String.fromCharCode(65 + index)}`;

export function buildRankingPrompt(
  title: string,
  description: string,
  messages: { label: string; message: string }[],
) {
  return [
    wrapUserData('공고 제목', title, 200),
    wrapUserData('공고 설명', description, 3000),
    ...messages.map((m) => wrapUserData(m.label, m.message || '(메시지 없음)', 1000)),
  ].join('\n');
}

export function validateFits(
  json: unknown,
  labels: string[],
): Map<string, { score: number; reason: string }> | null {
  const fits = (json as any)?.fits;
  if (!Array.isArray(fits)) return null;
  const out = new Map<string, { score: number; reason: string }>();
  for (const f of fits) {
    const label = typeof f?.label === 'string' ? f.label : '';
    const score = Number(f?.score);
    const reason = clampText(f?.reason, 120);
    if (!labels.includes(label) || !Number.isInteger(score) || score < 0 || score > 20 || !reason) {
      return null;
    }
    out.set(label, { score, reason });
  }
  return labels.every((l) => out.has(l)) ? out : null;
}

function tokens(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/[a-z0-9가-힣]{2,}/g) ?? []).filter((t) => t.length >= 2),
  );
}

/** 규칙 기반 메시지 적합도: 공고의 핵심 단어가 메시지에 얼마나 등장하는지 (0~20) */
export function ruleFit(bountyText: string, message: string): { score: number; reason: string } {
  const bt = tokens(bountyText);
  const mt = tokens(message);
  if (bt.size === 0 || mt.size === 0) return { score: 0, reason: '메시지가 없거나 비교할 내용이 없음' };
  let hit = 0;
  for (const t of mt) if (bt.has(t)) hit++;
  const ratio = Math.min(1, hit / Math.min(bt.size, 12));
  return { score: Math.round(ratio * 20), reason: `공고 핵심 단어 ${hit}개가 메시지에 등장 (단어 겹침 기준)` };
}

/** 메시지 성의 (0~10): 길이 기준. 200자 이상이면 만점 */
export function effortScore(message: string): number {
  const len = (message ?? '').trim().length;
  return Math.round(Math.min(1, len / 200) * 10);
}
