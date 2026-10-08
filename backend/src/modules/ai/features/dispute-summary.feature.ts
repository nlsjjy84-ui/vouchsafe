import { clampText, containsVerdict, numbersGrounded, wrapUserData } from '../ai-guards';

/**
 * 기능 4: 분쟁 요약 (관리자 전용). 쟁점을 정리할 뿐 누가 옳은지는 말하지 않는다.
 * 출력에 판정 표현(환불/정산 권고, 귀책, 승소/패소 등)이 있거나, 입력에 없는 숫자가 있으면 버린다.
 */
export interface DisputeSummary {
  summary: string;
  clientPoints: string[];
  expertPoints: string[];
  checkpoints: string[];
}

export interface DisputeFacts {
  bountyTitle: string;
  bountyDescription: string;
  amount: number;
  disputeReason: string;
  requirements: string[];
  submissionNotes: string[];
  submissionCount: number;
}

export const DISPUTE_INSTRUCTIONS = [
  '분쟁 쟁점을 중립적으로 정리합니다. 누가 옳은지, 환불/정산을 해야 하는지는 절대 쓰지 않습니다.',
  '자료에 적힌 사실과 각 측 주장만 정리하고, 관리자가 확인해야 할 점을 checkpoints에 적습니다.',
  '출력 형식: {"summary":"200자 이내","clientPoints":["..."],"expertPoints":["..."],"checkpoints":["..."]}',
].join('\n');

export function buildDisputePrompt(f: DisputeFacts) {
  return [
    `프로젝트 금액: ${f.amount}원, 제출 횟수: ${f.submissionCount}회`,
    wrapUserData('공고 제목', f.bountyTitle, 200),
    wrapUserData('공고 설명', f.bountyDescription, 2500),
    wrapUserData('확정된 요구사항', f.requirements.join('\n') || '(확정된 요구사항 없음)', 1500),
    wrapUserData('의뢰인 이의제기 사유', f.disputeReason, 2000),
    ...f.submissionNotes.slice(0, 5).map((n, i) => wrapUserData(`제출 메모 ${i + 1}`, n, 1000)),
  ].join('\n');
}

export function factsCorpus(f: DisputeFacts): string {
  return [f.bountyTitle, f.bountyDescription, String(f.amount), String(f.submissionCount),
    f.disputeReason, ...f.requirements, ...f.submissionNotes].join('\n');
}

export function validateDisputeSummary(json: unknown, corpus: string): DisputeSummary | null {
  const j: any = json;
  const summary = clampText(j?.summary, 300);
  const list = (v: unknown) =>
    Array.isArray(v)
      ? (v.map((x) => clampText(x, 200)).filter((x): x is string => x !== null).slice(0, 8))
      : null;
  const clientPoints = list(j?.clientPoints);
  const expertPoints = list(j?.expertPoints);
  const checkpoints = list(j?.checkpoints);
  if (!summary || !clientPoints || !expertPoints || !checkpoints) return null;
  const all = [summary, ...clientPoints, ...expertPoints, ...checkpoints].join('\n');
  if (containsVerdict(all)) return null;
  if (!numbersGrounded(all, corpus)) return null;
  return { summary, clientPoints, expertPoints, checkpoints };
}

/** 규칙 기반: 해석 없이 사실만 나열 */
export function ruleBasedDisputeSummary(f: DisputeFacts): DisputeSummary {
  return {
    summary: `프로젝트 "${f.bountyTitle.slice(0, 60)}" (${f.amount}원)에 대해 의뢰인이 이의를 제기했습니다. 결과물은 ${f.submissionCount}회 제출되었습니다.`,
    clientPoints: [f.disputeReason.slice(0, 200)],
    expertPoints: f.submissionNotes.length
      ? f.submissionNotes.slice(0, 3).map((n) => n.slice(0, 200))
      : ['제출 메모가 없습니다'],
    checkpoints: [
      f.requirements.length
        ? '확정된 요구사항 대비 제출물을 직접 대조해 보세요'
        : '확정된 요구사항이 없어 공고 설명을 기준으로 대조해야 합니다',
      '제출 파일의 실제 내용은 이 요약에 반영되지 않았습니다',
    ],
  };
}
