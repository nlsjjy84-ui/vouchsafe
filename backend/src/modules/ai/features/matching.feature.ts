import { clampText, wrapUserData } from '../ai-guards';

/**
 * 기능 7·8: AI 매칭 (의뢰 → 전문가 추천 / 전문가 → 의뢰 추천). 선택은 항상 사람이 한다.
 *
 * 설계 원칙
 *  - 후보는 서버가 먼저 거른다: "이 분야에서 승인된 자격이 있는 전문가"만 의뢰 쪽 후보가 된다.
 *    AI는 후보를 추가하거나 자격을 판단하지 못한다(자격 검증은 AI 영역이 아니다).
 *  - 평판·인증·경력·최신성·경쟁 정도는 서버가 계산한다. AI는 "과거 완료 프로젝트 제목 ↔ 공고 내용의
 *    주제 적합도"만 정수 점수 + 한 줄 근거로 낸다. 점수 범위를 벗어나면 결과 전체를 버리고 규칙 기반으로 대체한다.
 *  - AI에는 이름·이메일·ID를 보내지 않는다. '후보 A/B', '공고 A/B' 라벨만 보낸다.
 */

export const EXPERT_FIT_MAX = 25; // 의뢰 → 전문가: 주제 적합도 25점
export const BOUNTY_FIT_MAX = 50; // 전문가 → 의뢰: 주제 적합도 50점

export const EXPERT_MATCH_INSTRUCTIONS = [
  '공고 내용과 각 후보가 과거에 "완료한 프로젝트 제목"을 비교해 주제·기술이 얼마나 가까운지만 0~25 정수로 평가합니다.',
  '후보의 평판·자격·가격은 평가하지 않습니다(다른 곳에서 계산됨). 제시된 제목에 적힌 내용만 근거로 삼고, 없는 경력을 추측하지 않습니다.',
  '모든 후보를 빠짐없이 한 항목씩 출력합니다. 관련이 없으면 0점과 그 이유를 적습니다.',
  '출력 형식: {"fits":[{"label":"후보 A","score":0,"reason":"80자 이내 근거"}]}',
].join('\n');

export const BOUNTY_MATCH_INSTRUCTIONS = [
  '한 전문가가 과거에 "완료한 프로젝트 제목" 목록과 여러 공고를 비교해, 각 공고가 그 전문가의 이력과 주제·기술이 얼마나 가까운지 0~50 정수로 평가합니다.',
  '금액·마감·경쟁 정도는 평가하지 않습니다(다른 곳에서 계산됨). 제시된 제목과 공고 내용에 적힌 것만 근거로 삼고, 없는 경력을 추측하지 않습니다.',
  '모든 공고를 빠짐없이 한 항목씩 출력합니다. 관련이 없으면 0점과 그 이유를 적습니다.',
  '출력 형식: {"fits":[{"label":"공고 A","score":0,"reason":"80자 이내 근거"}]}',
].join('\n');

export const expertLabel = (i: number) => `후보 ${String.fromCharCode(65 + i)}`;
export const bountyLabel = (i: number) => `공고 ${String.fromCharCode(65 + i)}`;

export function buildExpertMatchPrompt(
  title: string,
  description: string,
  candidates: { label: string; titles: string[] }[],
) {
  return [
    wrapUserData('공고 제목', title, 200),
    wrapUserData('공고 설명', description, 3000),
    ...candidates.map((c) => wrapUserData(c.label + ' 완료 프로젝트 제목', c.titles.join('\n'), 800)),
  ].join('\n');
}

export function buildBountyMatchPrompt(
  expertTitles: string[],
  bounties: { label: string; title: string; description: string }[],
) {
  return [
    wrapUserData('전문가 완료 프로젝트 제목', expertTitles.join('\n'), 1200),
    ...bounties.map((b) => wrapUserData(b.label, `${b.title}\n${b.description}`, 800)),
  ].join('\n');
}

/**
 * 점수 범위가 어긋나면(정수 아님·범위 밖) 결과 전체를 버린다(→ 규칙 기반 대체).
 * 단, 점수와 무관한 두 가지는 너그럽게 본다: 요청하지 않은 라벨의 항목은 무시하고,
 * 점수 0점에 모델이 이유를 비워 보낸 경우에는 기본 문구를 쓴다(이유는 설명용이고 점수 판단 근거가 아니다).
 */
export function validateMatchFits(
  json: unknown,
  labels: string[],
  max: number,
): Map<string, { score: number; reason: string }> | null {
  const fits = (json as any)?.fits;
  if (!Array.isArray(fits)) return null;
  const out = new Map<string, { score: number; reason: string }>();
  for (const f of fits) {
    const label = typeof f?.label === 'string' ? f.label.trim() : '';
    if (!labels.includes(label)) continue; // 요청하지 않은 라벨은 무시
    const score = Number(f?.score);
    if (!Number.isInteger(score) || score < 0 || score > max) return null;
    const reason = clampText(f?.reason, 120) || '모델이 근거를 적지 않음';
    out.set(label, { score, reason });
  }
  // 모델이 "무관한" 항목을 통째로 빼는 경우가 실제로 관찰됐다(JSON은 정상). 최소 한 개라도 평가했다면
  // 빠진 항목은 0점으로 처리한다 — 점수를 부풀리지 않는 쪽으로만 보정하므로 안전하다.
  if (out.size === 0) return null;
  for (const l of labels) {
    if (!out.has(l)) out.set(l, { score: 0, reason: '모델이 평가하지 않아 0점으로 처리함' });
  }
  return out;
}

function tokens(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z0-9가-힣]{2,}/g) ?? []));
}

/** 규칙 기반 주제 적합도: 공고 단어가 과거 완료 프로젝트 제목에 얼마나 겹치는지 */
export function ruleTopicFit(
  bountyText: string,
  pastTitles: string[],
  max: number,
): { score: number; reason: string } {
  if (pastTitles.length === 0) return { score: 0, reason: '이 분야 완료 이력이 없어 주제 적합도를 계산할 수 없음' };
  const bt = tokens(bountyText);
  const pt = tokens(pastTitles.join(' '));
  if (bt.size === 0 || pt.size === 0) return { score: 0, reason: '비교할 단어가 없음' };
  let hit = 0;
  for (const t of pt) if (bt.has(t)) hit++;
  const ratio = Math.min(1, hit / Math.min(pt.size, 8));
  return { score: Math.round(ratio * max), reason: `완료 프로젝트 제목과 겹치는 단어 ${hit}개 (단어 겹침 기준)` };
}

/** 의뢰 → 전문가: 경력 폭 점수 (이 분야 완료 건수, 5건 이상이면 만점 10) */
export function experiencePts(settledInDomain: number): number {
  return Math.min(5, settledInDomain) * 2;
}

/** 전문가 → 의뢰: 최신성 (0~10). 3일 이내 10, 7일 이내 6, 14일 이내 3 */
export function freshnessPts(createdAt: Date, now = new Date()): number {
  const days = (now.getTime() - createdAt.getTime()) / 86_400_000;
  return days <= 3 ? 10 : days <= 7 ? 6 : days <= 14 ? 3 : 0;
}

/** 전문가 → 의뢰: 경쟁 정도 (0~10). 지원자가 적을수록 높다 */
export function competitionPts(applicantCount: number): number {
  return applicantCount === 0 ? 10 : applicantCount <= 2 ? 6 : 2;
}
