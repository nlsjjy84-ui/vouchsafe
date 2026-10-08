import { clampText, wrapUserData } from '../ai-guards';
import { RequirementItem } from '../entities/bounty-requirement-set.entity';

/** 기능 1: 공고 설명 -> 검수 가능한 요구사항 체크리스트 */

export const REQUIREMENTS_INSTRUCTIONS = [
  '공고 설명에서 "결과물이 갖춰야 할 조건"을 검수 가능한 문장 3~8개로 뽑습니다.',
  '각 문장은 제출물을 보고 충족/미충족을 가릴 수 있어야 합니다. 모호한 표현("잘", "충분히")은 피합니다.',
  '공고에 없는 요구를 새로 만들지 않습니다.',
  '출력 형식: {"items":["...","..."]}  (각 120자 이내, 한국어)',
].join('\n');

export function buildRequirementsPrompt(title: string, description: string, domainLabel: string) {
  return [
    `분야: ${domainLabel}`,
    wrapUserData('공고 제목', title, 200),
    wrapUserData('공고 설명', description, 4000),
  ].join('\n');
}

export function validateRequirements(json: unknown): string[] | null {
  const items = (json as any)?.items;
  if (!Array.isArray(items)) return null;
  const cleaned = items
    .map((i) => clampText(i, 120))
    .filter((i): i is string => i !== null);
  if (cleaned.length < 2 || cleaned.length > 10) return null;
  return Array.from(new Set(cleaned));
}

const REQ_KEYWORDS = /(해야|필요|포함|제출|제공|요구|해 ?주|원합니다|바랍니다|할 것|보고서|테스트|기한|까지|이내|이상|이하)/;

/** 규칙 기반 대체: 요구 표현이 들어 있는 문장을 골라 그대로 항목으로 쓴다 */
export function ruleBasedRequirements(description: string): string[] {
  const sentences = description
    .replace(/\r/g, '')
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((s) => s.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter((s) => s.length >= 4);
  const picked = sentences.filter((s) => REQ_KEYWORDS.test(s));
  const base = (picked.length >= 2 ? picked : sentences).slice(0, 8);
  const items = base.map((s) => s.slice(0, 120));
  if (items.length === 0) items.push('공고 설명에 적힌 작업 범위를 모두 반영한 결과물이 제출되어야 한다');
  return items;
}

export function toItems(texts: string[]): RequirementItem[] {
  return texts.map((text, i) => ({ id: `R${i + 1}`, text }));
}
