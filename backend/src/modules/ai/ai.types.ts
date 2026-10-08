/**
 * AI 공통 타입.
 * 원칙: AI 결과는 "참고용(advisory)"이다. 상태 전환·정산·환불 같은 돈과 권한에 관한
 * 결정은 AI 결과로 자동 실행하지 않고, 항상 사람(의뢰인/관리자)이 확정한다.
 */
export type AiFeature =
  | 'REQUIREMENTS_DRAFT'
  | 'APPLICANT_RANKING'
  | 'SUBMISSION_CHECK'
  | 'DISPUTE_SUMMARY'
  | 'PRICE_REFERENCE'
  | 'MILESTONE_DRAFT'
  | 'EXPERT_MATCH'
  | 'BOUNTY_MATCH'
  | 'REVIEW_DRAFT'
  | 'REVIEW_SUMMARY'
  | 'BOUNTY_DRAFT'
  | 'RISK_CHECK';

/** 결과가 어디서 나왔는지. AI = 실제 LLM 호출 결과, RULE = 규칙 기반 대체 결과. */
export type AiSource = 'AI' | 'RULE';

export interface AiCompletionRequest {
  system: string;
  user: string;
  maxTokens: number;
}

export interface AiCompletionResult {
  text: string;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AiProvider {
  readonly name: string;
  /** 키와 모델이 환경변수에 모두 있을 때만 true. 호출 시점에 읽는다(import 시점 X). */
  isConfigured(): boolean;
  complete(req: AiCompletionRequest): Promise<AiCompletionResult>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');

/** 모든 AI 기능 응답에 공통으로 붙는 출처 정보 */
export interface AiMeta {
  source: AiSource;
  provider: string | null;
  model: string | null;
  executionId: string | null;
  /** RULE로 떨어졌다면 이유(키 없음 / 호출 실패 / 출력 검증 실패 / 일일 한도) */
  fallbackReason: string | null;
  advisoryNotice: string;
}

export const ADVISORY_NOTICE =
  'AI가 만든 참고 자료입니다. 최종 판단과 확정은 사람이 합니다.';
