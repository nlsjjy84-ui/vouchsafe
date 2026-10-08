import { clampText, quoteInSource, wrapUserData } from '../ai-guards';
import { RequirementItem } from '../entities/bounty-requirement-set.entity';

/**
 * 기능 3: 제출물 1차 점검 (요구사항 체크리스트 대비)
 * 한계(중요): 지금 저장소 인터페이스에는 파일 "읽기"가 없어서, 점검 근거는 제출 메모와
 * 파일 이름/형식뿐이다. 파일 안의 내용은 읽지 못하므로 그 부분은 UNVERIFIABLE로 둔다.
 * 판정 규칙: MET/NOT_MET은 제출 메모 안에서 그대로 따온 인용(evidence)이 있어야 인정한다.
 */
export type CheckVerdict = 'MET' | 'NOT_MET' | 'UNVERIFIABLE';

export interface CheckLine {
  id: string;
  text: string;
  verdict: CheckVerdict;
  evidence: string | null;
  comment: string;
}

export const SUBMISSION_INSTRUCTIONS = [
  '요구사항 각각이 "제출 메모"만으로 충족되었는지 판정합니다. 파일 내용은 볼 수 없습니다.',
  '판정: MET(메모에 충족했다는 근거가 명시됨) / NOT_MET(메모가 충족하지 않았다고 밝히거나 명백히 빠뜨림) / UNVERIFIABLE(메모만으로는 알 수 없음).',
  'MET와 NOT_MET은 반드시 제출 메모에서 그대로 복사한 인용구를 evidence에 넣습니다. 인용할 수 없으면 UNVERIFIABLE입니다.',
  '출력 형식: {"checks":[{"id":"R1","verdict":"MET","evidence":"메모에서 그대로 인용","comment":"60자 이내"}]}',
].join('\n');

export function buildSubmissionPrompt(
  requirements: RequirementItem[],
  note: string,
  fileName: string,
) {
  return [
    '요구사항:',
    requirements.map((r) => `${r.id}. ${r.text}`).join('\n'),
    wrapUserData('제출 메모', note || '(메모 없음)', 3000),
    `제출 파일 이름: ${fileName.replace(/[^\w.\-가-힣 ]/g, '_').slice(0, 120)}`,
  ].join('\n');
}

export function validateChecks(
  json: unknown,
  requirements: RequirementItem[],
  note: string,
): CheckLine[] | null {
  const checks = (json as any)?.checks;
  if (!Array.isArray(checks)) return null;
  const byId = new Map<string, any>();
  for (const c of checks) if (typeof c?.id === 'string') byId.set(c.id, c);
  const lines: CheckLine[] = [];
  for (const r of requirements) {
    const c = byId.get(r.id);
    if (!c) return null;
    const verdict = c.verdict as CheckVerdict;
    if (!['MET', 'NOT_MET', 'UNVERIFIABLE'].includes(verdict)) return null;
    const comment = clampText(c.comment, 100) ?? '';
    let evidence: string | null = null;
    if (verdict !== 'UNVERIFIABLE') {
      evidence = clampText(c.evidence, 300);
      // 근거가 제출 메모에 실제로 있는 문장이 아니면 AI 판정을 통째로 버린다.
      if (!evidence || !quoteInSource(evidence, note)) return null;
    }
    lines.push({ id: r.id, text: r.text, verdict, evidence, comment });
  }
  return lines;
}

const tok = (s: string) =>
  new Set((s.toLowerCase().match(/[a-z0-9가-힣]{2,}/g) ?? []));

/** 규칙 기반: NOT_MET은 절대 내지 않는다. 단어가 충분히 겹치는 메모 문장이 있을 때만 MET 후보 */
export function ruleBasedChecks(requirements: RequirementItem[], note: string): CheckLine[] {
  const sentences = note
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);
  return requirements.map((r) => {
    const rt = tok(r.text);
    let best: { s: string; ratio: number } | null = null;
    for (const s of sentences) {
      const st = tok(s);
      let hit = 0;
      for (const t of rt) if (st.has(t)) hit++;
      const ratio = rt.size ? hit / rt.size : 0;
      if (!best || ratio > best.ratio) best = { s, ratio };
    }
    if (best && best.ratio >= 0.6) {
      return {
        id: r.id,
        text: r.text,
        verdict: 'MET' as const,
        evidence: best.s.slice(0, 300),
        comment: '메모에 같은 표현이 있음 (단어 겹침 기준, 실제 충족 여부는 직접 확인 필요)',
      };
    }
    return {
      id: r.id,
      text: r.text,
      verdict: 'UNVERIFIABLE' as const,
      evidence: null,
      comment: '메모만으로는 확인할 수 없음',
    };
  });
}
