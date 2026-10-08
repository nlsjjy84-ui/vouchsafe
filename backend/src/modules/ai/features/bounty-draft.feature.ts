import { DomainType, DOMAIN_LABELS } from '../../../common/enums/domain-type.enum';
import { clampText, numbersGrounded, wrapUserData } from '../ai-guards';

/**
 * 기능 11: 프로젝트 등록 도우미. 의뢰인이 한두 문장으로 적은 아이디어를 분야·제목·설명 초안과
 * "더 적어주면 좋은 점"으로 정리한다. 금액은 AI가 정하지 않는다(같은 분야 정산 통계를 서버가 따로 보여준다).
 * 입력에 없는 사실·숫자는 만들지 않고, 분야를 확신할 수 없으면 null로 두어 사람이 고르게 한다.
 */
export interface BountyDraft {
  domainType: DomainType | null;
  title: string;
  description: string;
  missing: string[];
}

export const BOUNTY_DRAFT_MIN_IDEA = 10;

export const BOUNTY_DRAFT_INSTRUCTIONS = [
  '의뢰인이 적은 아이디어를 전문가에게 보여줄 프로젝트 공고 초안으로 정리합니다.',
  `domainType은 다음 중 하나의 키로만 씁니다: ${Object.entries(DOMAIN_LABELS).map(([k, v]) => `${k}(${v})`).join(', ')}. 어느 분야인지 확신이 없으면 null.`,
  'title은 5~60자, description은 의뢰 목적·작업 범위·원하는 결과물 순서로 3~6문장, 1000자 이내로 씁니다.',
  '의뢰인이 쓰지 않은 사실, 금액, 날짜, 숫자, 지역은 절대 추가하지 않습니다. 모르는 것은 missing에 질문으로 적습니다(최대 3개, 각 60자 이내).',
  '출력 형식: {"domainType":"KEY 또는 null","title":"...","description":"...","missing":["..."]}',
].join('\n');

export function buildBountyDraftPrompt(idea: string, serviceType: string): string {
  return [`진행 방식: ${serviceType === 'COMPANION' ? '현장 동행' : '원격'}`, wrapUserData('의뢰인 아이디어', idea, 800)].join('\n');
}

export function validateBountyDraft(json: unknown, idea: string): BountyDraft | null {
  const j: any = json;
  let domainType: DomainType | null = null;
  if (j?.domainType !== null && j?.domainType !== undefined && j?.domainType !== 'null') {
    if (!Object.values(DomainType).includes(j.domainType)) return null;
    domainType = j.domainType as DomainType;
  }
  const title = clampText(j?.title, 60);
  const description = clampText(j?.description, 1200);
  if (!title || title.length < 5 || !description || description.length < 20) return null;
  const missingRaw = Array.isArray(j?.missing) ? j.missing : [];
  const missing = missingRaw.map((m: unknown) => clampText(m, 80)).filter((m: string | null): m is string => m !== null).slice(0, 3);
  // 입력에 없던 숫자(금액·날짜 등)를 지어냈다면 버린다
  if (!numbersGrounded(`${title}\n${description}`, idea)) return null;
  return { domainType, title, description, missing };
}

const DOMAIN_KEYWORDS: [RegExp, DomainType][] = [
  [/중고차|차량|자동차|엔진|정비/, DomainType.VEHICLE_DIAGNOSTICS],
  [/등기|권리분석|전세|임장|부동산|경매/, DomainType.REAL_ESTATE_TITLE_ANALYSIS],
  [/계약서|약관|법률|법무/, DomainType.STARTUP_CONTRACT_REVIEW],
  [/세무|절세|세금|부가세|종합소득/, DomainType.TAX_STRUCTURE_FACTCHECK],
  [/쿼리|인덱스|디비|DB|데이터베이스|튜닝/i, DomainType.BACKEND_DB_TUNING],
  [/스마트 ?컨트랙트|블록체인|web3|솔리디티/i, DomainType.WEB3_SECURITY_AUDIT],
  [/크롤링|스크래핑|파싱/, DomainType.CRAWLING_ARCHITECTURE],
  [/모바일|앱 ?테스트|QA 자동화/i, DomainType.MOBILE_QA_AUTOMATION],
  [/게임/, DomainType.INDIE_GAME_QA],
  [/3D|그래픽|렌더|에셋/i, DomainType.GRAPHICS_3D_OPTIMIZATION],
  [/믹싱|마스터링|음원/, DomainType.AUDIO_MASTERING_REVIEW],
  [/유튜브|채널|크리에이터/, DomainType.TECH_CREATOR_CONSULTING],
  [/하자|누수|건축|시공/, DomainType.BUILDING_DEFECT_INSPECTION],
  [/소방|스프링클러|안전점검/, DomainType.FIRE_SAFETY_INSPECTION],
  [/코드 ?리뷰|개발|리팩토링|버그/, DomainType.DEV_CODE_REVIEW],
];

/** 규칙 기반: 키워드로 분야를 추정하고, 적은 내용을 그대로 정리한다. 분야를 못 찾으면 null. */
export function ruleBasedBountyDraft(idea: string): BountyDraft {
  const text = idea.replace(/\s+/g, ' ').trim();
  const domainType = DOMAIN_KEYWORDS.find(([re]) => re.test(text))?.[1] ?? null;
  const firstSentence = text.split(/(?<=[.!?。])\s|\n/)[0] ?? text;
  const title = (firstSentence.length >= 5 ? firstSentence : text).slice(0, 60);
  const description = text.length >= 20 ? text.slice(0, 1200) : `${text}\n(자세한 작업 범위와 원하는 결과물을 더 적어 주세요.)`;
  return {
    domainType,
    title: title.length >= 5 ? title : `${title} 의뢰`,
    description,
    missing: [
      '원하는 결과물(보고서, 수정된 코드 등)은 무엇인가요?',
      '언제까지 필요한가요?',
      '전문가가 미리 알아야 할 조건이 있나요?',
    ],
  };
}
