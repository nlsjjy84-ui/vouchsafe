import { quoteInSource, wrapUserData, clampText } from '../ai-guards';

/**
 * 기능 12: 위험 신호 점검. 공고·지원 메시지에서 플랫폼 밖 거래 유도, 연락처 교환, 선입금·계좌 직접 입금,
 * 개인정보·인증정보 요구, 비현실적 보장, 압박 표현을 찾아 알려준다.
 *
 * 규칙 탐지가 기본이고(항상 동작, 결과가 같다), AI는 규칙이 놓친 표현을 같은 분류 안에서 추가로 찾는다.
 * AI가 낸 신호는 원문에 실제로 있는 문장(인용)이 있어야만 인정한다. 위험 등급은 AI가 아니라 신호 종류로
 * 서버가 계산한다. 차단이 아니라 경고이며, 판단은 사람이 한다.
 */
export type RiskType = 'OFF_PLATFORM' | 'CONTACT' | 'ADVANCE_PAYMENT' | 'CREDENTIALS' | 'GUARANTEE' | 'PRESSURE';
export type RiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskSignal {
  type: RiskType;
  quote: string;
  why: string;
  source: 'RULE' | 'AI';
}

export interface RiskResult {
  level: RiskLevel;
  signals: RiskSignal[];
}

export const RISK_META: Record<RiskType, { label: string; why: string; weight: 'HIGH' | 'MEDIUM' | 'LOW' }> = {
  OFF_PLATFORM: { label: '플랫폼 밖 거래 유도', why: '에스크로 밖에서 거래하면 분쟁 때 보호받을 수 없어요.', weight: 'HIGH' },
  CONTACT: { label: '연락처 교환 시도', why: '외부 메신저·전화로 옮기면 기록이 남지 않아요. 플랫폼의 안심번호를 쓰세요.', weight: 'MEDIUM' },
  ADVANCE_PAYMENT: { label: '선입금·직접 입금 요구', why: '정산 전 직접 입금은 환불이 어려워요. 결제는 에스크로로만 하세요.', weight: 'HIGH' },
  CREDENTIALS: { label: '개인·인증정보 요구', why: '비밀번호, 인증번호, 신분증 사진은 어떤 이유로도 보내면 안 돼요.', weight: 'HIGH' },
  GUARANTEE: { label: '비현실적 보장', why: '"100% 보장", "무조건" 같은 표현은 과장일 가능성이 높아요.', weight: 'LOW' },
  PRESSURE: { label: '재촉·압박 표현', why: '판단할 시간을 주지 않는 표현은 주의가 필요해요.', weight: 'LOW' },
};

const RULES: [RiskType, RegExp][] = [
  ['OFF_PLATFORM', /(플랫폼|사이트|앱)\s?(밖|외부|말고)|(수수료|검증료)\s?(아끼|절약|없이|면제)|직거래|따로\s?(거래|정산|결제)|밖에서\s?(거래|정산|진행)/],
  ['CONTACT', /카톡|카카오톡|오픈채팅|텔레그램|라인\s?ID|위챗|디스코드|\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b|[\w.+-]+@[\w-]+\.[\w.-]+/i],
  ['ADVANCE_PAYMENT', /선입금|먼저\s?(입금|송금|보내)|계좌(로|에)?\s?(직접|바로)?\s?(입금|송금)|계좌번호|입금\s?(먼저|부터)/],
  ['CREDENTIALS', /비밀번호|패스워드|OTP|인증\s?번호|보안\s?카드|주민(등록)?\s?번호|신분증\s?(사진|사본)|공동\s?인증서|개인\s?키|시드\s?(문구|구문)|private\s?key/i],
  ['GUARANTEE', /100\s?%\s?(보장|성공|환불)|무조건\s?(성공|보장|수익|합격)|원금\s?보장|실패\s?없|절대\s?(안전|실패)/],
  ['PRESSURE', /지금\s?당장|오늘\s?안에\s?(꼭|반드시)|즉시\s?(입금|결정)|마감\s?임박|놓치면\s?(후회|끝)/],
];

function snippet(text: string, index: number, len: number): string {
  const start = Math.max(0, index - 10);
  return text.slice(start, Math.min(text.length, index + len + 20)).replace(/\s+/g, ' ').trim();
}

/** 한글로 쓴 숫자. "공일공 일이삼사"처럼 전화번호를 글자로 풀어 쓰는 경우를 잡는다. */
const HANGUL_DIGITS: Record<string, string> = {
  공: '0', 영: '0', 빵: '0', 일: '1', 하나: '1', 이: '2', 둘: '2', 삼: '3', 셋: '3', 사: '4', 넷: '4',
  오: '5', 육: '6', 륙: '6', 칠: '7', 팔: '8', 구: '9',
};
const FULLWIDTH_DIGIT = /[０-９]/;
/** 숫자 사이에 끼워 넣는 띄어쓰기·기호. 이것들은 건너뛰고 숫자를 이어 붙인다. */
const DIGIT_SEPARATORS = /[\s\-.·•_~,()\[\]{}*'"`/|+;]/; // ':'는 넣지 않는다(날짜·시각 "2026-10-14 10:00"이 이어 붙지 않게)

/**
 * 숫자를 한글·띄어쓰기·기호로 쪼개 쓴 전화번호·계좌번호를 찾는다.
 * 한글 숫자를 숫자로 바꾸고 구분 기호를 건너뛰며 숫자를 이어 붙였을 때,
 * 0으로 시작하는 9자리 이상(전화) 또는 11자리 이상(계좌)이 나오면 연락처로 본다.
 * 다른 글자가 나오면 끊어서 세므로 "이사 오일 걸려요", "150만 원", "2026-10-14" 같은 보통 문장은 걸리지 않는다.
 */
export function hiddenNumber(text: string): string | null {
  let digits = '';
  let start = -1;
  const flush = (end: number): string | null => {
    const hit = (digits.length >= 9 && digits.startsWith('0')) || digits.length >= 11;
    const quote = hit ? text.slice(start, end).trim() : null;
    digits = '';
    start = -1;
    return quote;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const two = text.slice(i, i + 2);
    let d: string | null = null;
    let step = 1;
    if (/[0-9]/.test(ch)) d = ch;
    else if (FULLWIDTH_DIGIT.test(ch)) d = String(ch.charCodeAt(0) - 0xff10);
    else if (HANGUL_DIGITS[two] && two.length === 2) { d = HANGUL_DIGITS[two]; step = 2; }
    else if (HANGUL_DIGITS[ch]) d = HANGUL_DIGITS[ch];
    if (d !== null) {
      if (start < 0) start = i;
      digits += d;
      i += step - 1;
      continue;
    }
    if (DIGIT_SEPARATORS.test(ch) && start >= 0) continue;
    const q = flush(i);
    if (q) return q;
  }
  return flush(text.length);
}

/**
 * 띄어쓰기·기호를 넣거나 비슷한 말로 바꿔 쓴 메신저·이메일 표현.
 * 비교는 공백과 기호를 모두 뺀 소문자 문장에서 한다("카 . 톡" → "카톡").
 */
const HIDDEN_CONTACT_WORDS =
  /(?:카|까|캬|깨)(?:톡|똑|토크)|ㅋㅌ|카카오(?!페이|맵|뱅크|모빌리티)|kakao(?!pay|map|bank)|katalk|오픈채팅|오픈톡|오카방|텔레(?:그램|그|방|주|줘|로|아이디|id)|telegram|텔그|라인아이디|라인id|lineid|위챗|wechat|디스코드|discord|디코(?!딩|더|드)|인스타(?:그램)?(?:dm|디엠)|(?:디엠|dm)(?:주|줘|보내|으로|부탁)|(?:문자|전화)(?:주세요|줘|부탁|보내|번호)|번호(?:를)?(?:알려|남겨|주세요|줘|보내|드릴|드려)|골뱅이|(?:닷|dot)(?:컴|com|넷|net)|지메일|gmail|네이버메일|naver(?:닷|dot)?com|한메일|hanmail|daum(?:닷|dot)?net/;

export function hiddenContact(text: string): string | null {
  const num = hiddenNumber(text);
  if (num) return num;
  const squashed = text.toLowerCase().replace(/[\s.·•\-_~,*'"`/|\\()\[\]{}!?^+=:;]/g, '');
  const m = HIDDEN_CONTACT_WORDS.exec(squashed);
  return m ? m[0] : null;
}

export function ruleBasedRisk(text: string): RiskSignal[] {
  const out: RiskSignal[] = [];
  for (const [type, re] of RULES) {
    const m = re.exec(text);
    if (m) out.push({ type, quote: snippet(text, m.index, m[0].length), why: RISK_META[type].why, source: 'RULE' });
  }
  // 정규식이 못 잡는 우회 표현(한글 숫자, 띄어쓰기·기호로 쪼갠 메신저 이름 등)
  if (!out.some((s) => s.type === 'CONTACT')) {
    const hidden = hiddenContact(text);
    if (hidden) out.push({ type: 'CONTACT', quote: hidden, why: RISK_META.CONTACT.why, source: 'RULE' });
  }
  return out;
}

export function levelOf(signals: RiskSignal[]): RiskLevel {
  if (signals.length === 0) return 'NONE';
  if (signals.some((s) => RISK_META[s.type].weight === 'HIGH')) return 'HIGH';
  const mediums = signals.filter((s) => RISK_META[s.type].weight === 'MEDIUM').length;
  if (mediums > 0 || signals.length >= 2) return 'MEDIUM';
  return 'LOW';
}

export const RISK_INSTRUCTIONS = [
  '전문가 거래 플랫폼의 공고·지원 메시지에서 사기나 플랫폼 밖 거래로 이어질 수 있는 위험 신호를 찾습니다.',
  `type은 다음 중 하나만 씁니다: ${Object.entries(RISK_META).map(([k, v]) => `${k}(${v.label})`).join(', ')}.`,
  '각 신호에는 원문에 실제로 있는 문장 일부를 quote에 글자 하나 바꾸지 않고 그대로 옮깁니다. 원문에 없으면 신호로 쓰지 않습니다.',
  '평범한 작업 설명은 신호가 아닙니다. 확실하지 않으면 빈 배열을 돌려줍니다. 최대 4개.',
  '출력 형식: {"signals":[{"type":"OFF_PLATFORM","quote":"원문 그대로","why":"한 문장 이유"}]}',
].join('\n');

export function buildRiskPrompt(text: string, kind: string): string {
  return [`글의 종류: ${kind === 'APPLICATION' ? '전문가 지원 메시지' : '의뢰 공고'}`, wrapUserData('검사할 글', text, 3000)].join('\n');
}

export function validateRisk(json: unknown, text: string): RiskSignal[] | null {
  const arr = (json as any)?.signals;
  if (!Array.isArray(arr)) return null;
  const out: RiskSignal[] = [];
  for (const s of arr.slice(0, 4)) {
    const type = s?.type as RiskType;
    if (!(type in RISK_META)) continue;
    const quote = clampText(s?.quote, 160);
    const why = clampText(s?.why, 120) ?? RISK_META[type].why;
    if (!quote || !quoteInSource(quote, text)) continue; // 원문에 없는 인용은 버린다
    out.push({ type, quote, why, source: 'AI' });
  }
  return out;
}

/** 규칙 신호 + AI 신호를 합친다. 같은 종류는 규칙 신호를 우선한다. */
export function mergeRisk(rule: RiskSignal[], ai: RiskSignal[]): RiskResult {
  const seen = new Set(rule.map((r) => r.type));
  const signals = [...rule, ...ai.filter((a) => !seen.has(a.type))];
  return { level: levelOf(signals), signals };
}
