'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

/**
 * 풍이와 결이의 길 안내 (AIRA·잇결과 같은 대표 캐릭터).
 * 작은 불빛이 다음에 누를 곳으로 앞서가고, 두 캐릭터가 한두 줄로 "이게 뭔지, 왜 안전한지"만 말한다.
 *  - 처음에 3분 간략 / 10분 자세히 / 평가자용 빠른 코스를 고른다.
 *  - 3분은 핵심 네 곳, 10분은 4구역 열두 곳, 평가자용은 "AI와 돈을 믿을 수 있게 만든 다섯 곳".
 *  - 직접 눌러 봐야 「다음」이 빛난다. 길을 벗어나면 "지금 ○○ → 다음 △△"와 [데려다 드릴게요].
 *  - 데모 계정은 둘러보기 전용이라, 무언가를 저장·등록·결제하는 버튼은 안내하지 않는다.
 */

type Loc = { path: string };
type Step = {
  who: 'pung' | 'gyeol';
  place: string;
  path?: string;
  detail?: boolean;
  landing?: boolean;
  target: () => Element | null;
  say: string;
  after?: string;
  note?: string;
  look?: boolean;
  fill?: { selector: string; value: string };
  react?: () => string | null;
  skip?: () => boolean;
};

const STORE_KEY = 'credo-guide-v1';
const GREETED_KEY = 'credo-guide-greeted';
const DETAIL_FALLBACK = '/bounties/88d13c82-7057-4b34-a4ab-12bb6b740f28';
const DETAIL_RE = /^\/bounties\/[0-9a-fA-F-]{36}$/;

export const SPEAKERS = {
  pung: { name: '풍이', img: '/guide/pung.webp' },
  gyeol: { name: '결이', img: '/guide/gyeol.webp' },
};

const one = (selector: string) => () => document.querySelector(selector);
/** 글자를 품은 요소 중 가장 안쪽(문서 순서상 마지막) 요소. */
const deepest = (selector: string, text: string) => () => {
  const found = Array.from(document.querySelectorAll(selector)).filter((el) => (el.textContent ?? '').includes(text));
  return found[found.length - 1] ?? null;
};
const boxOf = (selector: string, text: string, box = 'section, div') => () => {
  const head = Array.from(document.querySelectorAll(selector)).find((el) => (el.textContent ?? '').trim().includes(text));
  return head?.closest(box) ?? null;
};
const escrowCard = () =>
  Array.from(document.querySelectorAll('main a[href^="/bounties/"]')).find((a) => (a.textContent ?? '').includes('에스크로 락업')) ?? null;
/** AI 매칭의 「분야 고르기 + 전문가 추천받기」 줄(버튼 글자가 「찾는 중…」으로 바뀌어도 같은 줄을 가리킨다). */
const matchRow = () => {
  const button = Array.from(document.querySelectorAll('[data-guide="match-text"] button')).find((b) => /전문가 추천받기|찾는 중/.test(b.textContent ?? ''));
  return button?.parentElement ?? null;
};
const riskReaction = () => {
  const box = document.querySelector('[data-guide="risk-check"]');
  const text = box?.textContent ?? '';
  if (text.includes('위험 신호 없음')) return '위험 신호가 없다고 나왔어요. 수상한 문장을 넣으면 그 문장을 그대로 짚어서 알려 줘요.';
  if (/위험|주의/.test(text) && text.includes('AI') && !text.includes('점검 중')) {
    if (/외부|연락처|선입금|플랫폼 밖|카톡|계좌/.test(text)) return '찾았어요! 문제 문장을 그대로 짚고 왜 위험한지 알려 줘요. 막지는 않고 경고만 해요.';
  }
  return null;
};

const RISKY = '급하게 구해요. 카톡 아이디 남겨 주시면 따로 연락드릴게요. 착수금 50%는 제 계좌로 먼저 보내 주시면 바로 진행할게요.';

export const STEPS: Record<string, Step> = {
  entry: {
    who: 'pung', place: '첫 화면', landing: true, target: one('.vs-landing-action'),
    say: '가입 없이 바로 들어가 볼게요. 빛나는 「의뢰인으로 둘러보기」를 눌러 주세요.',
  },
  escrow: {
    who: 'pung', place: '마이페이지', path: '/mypage', target: escrowCard,
    say: '의뢰인 화면이에요. 「진행중 (에스크로 락업)」 프로젝트를 눌러 보세요. 대금은 결과물을 검수할 때까지 CREDO가 맡아 둬요.',
    after: '돈은 전문가에게 바로 가지 않아요. 결과물이 요구사항을 채웠는지 확인한 뒤에야 풀려요.',
  },
  checklist: {
    who: 'gyeol', place: '프로젝트 상세 · AI 도우미', detail: true, target: boxOf('main h3', '요구사항 체크리스트', 'section'), look: true,
    say: 'AI가 요청 글을 확인할 수 있는 체크리스트(R1~R5)로 쪼갰어요. 결과물을 받으면 항목마다 근거가 있는지 먼저 대조하고, 승인은 의뢰인이 직접 해요.',
  },
  safeNumber: {
    who: 'gyeol', place: '프로젝트 상세 · 안심번호', detail: true, target: boxOf('main h2', '안심번호', 'section, div.rounded-4xl'), look: true,
    say: '서로 실제 전화번호를 몰라도 안심번호로 연락해요. 거래가 플랫폼 밖으로 빠져나가는 일을 줄여요.',
  },
  draft: {
    who: 'pung', place: '프로젝트 등록 · AI 초안', path: '/bounties/new', target: one('[data-guide="ai-draft"]'),
    fill: { selector: '#ai-draft-idea', value: '이번 주말에 중고차 3대를 보러 가는데, 엔진 상태랑 사고 이력을 같이 봐줄 사람이 필요해요.' },
    say: '한두 문장만 적으면 AI가 분야·제목·상세 내용 초안을 채워요. 「대신 적어 드릴게요」 다음 「초안 만들기」를 눌러 보세요.',
    after: '금액은 AI가 정하지 않아요. 같은 분야에서 실제로 정산된 금액 범위만 참고로 보여 줘요.',
    note: '데모 계정은 둘러보기 전용이라 등록은 되지 않아요.',
  },
  risk: {
    who: 'gyeol', place: '프로젝트 등록 · 위험 신호 점검', path: '/bounties/new', target: one('[data-guide="risk-check"]'),
    fill: { selector: '#bounty-description', value: RISKY },
    say: '사기 글을 미리 걸러요. 「대신 적어 드릴게요」로 수상한 문장을 넣고 「위험 신호 점검」을 눌러 보세요.',
    after: '규칙이 먼저 찾고 AI가 우회 표현을 보태요. 신호마다 문제 문장을 그대로 보여 줘요.',
    react: riskReaction,
  },
  match: {
    who: 'pung', place: 'AI 매칭', path: '/matching', target: matchRow,
    fill: { selector: '#match-text', value: '다음 주에 중고 SUV를 사는데 같이 가서 사고 이력과 침수 여부를 봐 주실 분을 찾아요.' },
    say: '맡길 일을 적으면 전문가를 100점 만점으로 추천해요. 「대신 적어 드릴게요」 다음 「전문가 추천받기」를 눌러 보세요.',
    after: '평판·인증·경력은 서버가 실제 거래 기록으로 계산하고, AI는 주제 적합도만 매겨요. 고르는 건 사람이에요.',
  },
  offers: {
    who: 'gyeol', place: '전문가 상품', path: '/offers', target: one('main a[href^="/offers/"]:not([href="/offers/mine"]):not([href="/offers/new"])'), look: true,
    say: '자격을 인증받은 전문가가 미리 올려 둔 상품이에요. 카드마다 어떤 길로 인증했는지가 붙어 있어요.',
  },
  cases: {
    who: 'pung', place: '거래 사례', path: '/cases', target: deepest('main div', '이의 없이 성공'), look: true,
    say: '정산이 끝난 거래는 분쟁·환불까지 빠짐없이 자동으로 공개돼요. 실명과 정확한 금액만 가려요.',
  },
  map: {
    who: 'gyeol', place: '지역 찾기', path: '/map', target: one('.leaflet-container'), look: true,
    say: '우리 동네 전문가를 지도로 찾아요. 위치는 동 단위까지만 저장해서 집 주소는 남지 않아요.',
  },
  community: {
    who: 'gyeol', place: '커뮤니티', path: '/community', target: deepest('main button', '사기·주의'),
    say: '거래 후기·질문·사기 주의 글이 모여요. 「사기·주의」를 눌러 보세요.',
    after: '실제로 겪은 수법을 서로 알려 줘요. 위험 신호 점검과 함께 쓰면 더 안전해요.',
  },
  insights: {
    who: 'pung', place: 'AI 인사이트', path: '/insights', target: boxOf('main h2', '인사이트', 'div.rounded-4xl'), look: true,
    say: '내 지출을 분야별·월별로 정리하고, 눈에 띄는 점을 한 줄씩 짚어 줘요.',
  },
  chat: {
    who: 'gyeol', place: '상담 버튼', path: '/insights', target: one('button[aria-label="AI 챗봇 열기"]'),
    say: '궁금한 건 오른쪽 아래 상담 버튼에 물어보세요. 눌러 보세요.',
    after: '에스크로·수수료·분쟁처럼 자주 묻는 질문에 바로 답해요.',
  },
};

const claimNote = '데모 계정은 둘러보기 전용이라 결제·지원 같은 기록은 남지 않아요.';
Object.assign(STEPS, {
  jEscrow: {
    ...STEPS.escrow,
    say: '돈이 오가는 순서를 서버가 지켜요. 「진행중 (에스크로 락업)」 프로젝트를 눌러 보세요.',
    after: '모집 → 결제 대기 → 에스크로 잠금 → 제출 → 정산. 순서를 건너뛰는 요청은 서버가 거절하고, 지원자 선택은 행 잠금으로 두 번 눌려도 한 번만 처리돼요.',
    note: claimNote,
  },
  jChecklist: {
    ...STEPS.checklist,
    say: 'AI가 만든 체크리스트로 결과물을 검수해요. 항목마다 「충족 근거 있음·미충족·확인 불가」로만 답하고, 승인은 사람이 해요. 배지에 실제로 부른 AI 모델이 보여요.',
  },
  jRisk: {
    ...STEPS.risk,
    react: undefined,
    say: 'AI가 경고를 지어내지 못하게 막았어요. 「대신 적어 드릴게요」 다음 「위험 신호 점검」을 눌러 보세요.',
    after: 'AI가 짚은 문장이 글에 실제로 없으면 서버가 버려요. 정규식 규칙이 먼저 잡고, AI는 우회 표현만 보태요.',
  },
  jMatch: {
    ...STEPS.match,
    say: 'AI에게 일을 좁게 맡긴 예예요. 「대신 적어 드릴게요」 다음 「전문가 추천받기」를 눌러 보세요.',
    after: '평판 40·인증 25·경력 10점은 서버가 거래 기록으로 계산하고, AI는 주제 적합도 25점만 매겨요. AI에는 이름과 연락처를 보내지 않아요.',
  },
  jCases: {
    ...STEPS.cases,
    say: '편집되지 않은 전수 공개예요. 정산이 끝난 거래는 분쟁·환불까지 예외 없이 자동으로 올라오고, 누구도 빼거나 고를 수 없어요.',
  },
} as Record<string, Step>);

/** 평가자용 걸음을 마치면 같은 화면의 일반 걸음도 본 것으로 친다. */
export const SAME_PLACE: Record<string, string> = { jEscrow: 'escrow', jChecklist: 'checklist', jRisk: 'risk', jMatch: 'match', jCases: 'cases' };

type Course = 'short' | 'long' | 'judge';
export const COURSES: Record<Course, { name: string; zones: { name: string; ids: string[] }[] }> = {
  short: { name: '3분 간략', zones: [{ name: '핵심 네 곳', ids: ['escrow', 'checklist', 'draft', 'match'] }] },
  long: {
    name: '10분 자세히',
    zones: [
      { name: '① 맡기기', ids: ['draft', 'risk', 'match'] },
      { name: '② 안전한 거래', ids: ['escrow', 'checklist', 'safeNumber'] },
      { name: '③ 둘러보기', ids: ['offers', 'cases', 'map', 'community'] },
      { name: '④ 내 활동', ids: ['insights', 'chat'] },
    ],
  },
  judge: { name: '평가자용 빠른 코스', zones: [{ name: '기술 검증 다섯 곳', ids: ['jEscrow', 'jChecklist', 'jRisk', 'jMatch', 'jCases'] }] },
};

export function courseIds(course: Course) {
  return ['entry', ...COURSES[course].zones.flatMap((zone) => zone.ids)];
}

/** 받침에 맞춰 '예요/이에요'를 붙인다(괄호·기호는 건너뛰고 마지막 한글 글자로 본다). */
export function iyeyo(word: string) {
  const last = Array.from(word).reverse().find((ch) => ch >= '가' && ch <= '힣');
  if (!last) return `${word}예요`;
  return (last.charCodeAt(0) - 0xac00) % 28 === 0 ? `${word}예요` : `${word}이에요`;
}

export function placeName(path: string) {
  if (path === '/') return '첫 화면';
  if (path === '/mypage') return '마이페이지';
  if (path === '/bounties') return '프로젝트 둘러보기';
  if (path === '/bounties/new') return '프로젝트 등록';
  if (DETAIL_RE.test(path)) return '프로젝트 상세';
  if (path === '/matching') return 'AI 매칭';
  if (path === '/insights') return 'AI 인사이트';
  if (path.startsWith('/offers')) return '전문가 상품';
  if (path === '/cases') return '거래 사례';
  if (path === '/map') return '지역 찾기';
  if (path.startsWith('/community')) return '커뮤니티';
  if (path === '/certifications') return '전문가 인증';
  return '다른 화면';
}

function landingShown() {
  return Boolean(document.querySelector('.vs-landing-action'));
}

export function isAt(step: Step, loc: Loc, detailHref: string | null) {
  if (step.landing) return landingShown();
  if (step.detail) return detailHref ? loc.path === detailHref : DETAIL_RE.test(loc.path);
  return step.path === loc.path;
}

/** React가 관리하는 입력칸에 글자를 넣는다(값을 바꾼 뒤 input 이벤트를 보내야 화면 상태도 바뀐다). */
export function fillInput(selector: string, value: string) {
  const input = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus({ preventScroll: true });
  return true;
}

type State = { course: Course | null; index: number; open: boolean; done: string[]; log: { asks?: number; detail?: string; matched?: boolean; risk?: boolean } };
const EMPTY: State = { course: null, index: 0, open: false, done: [], log: {} };

function readStore(): Partial<State> | null {
  try {
    return JSON.parse(window.sessionStorage.getItem(STORE_KEY) ?? 'null');
  } catch {
    return null;
  }
}
function writeStore(value: State) {
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify(value));
  } catch {
    /* 저장이 안 되면 이 화면에서만 기억한다. */
  }
}
function greetedOnce() {
  try {
    if (window.sessionStorage.getItem(GREETED_KEY) === '1') return true;
    window.sessionStorage.setItem(GREETED_KEY, '1');
  } catch {
    /* 저장이 안 되면 한 번 인사하고 만다. */
  }
  return false;
}

type Rect = { top: number; left: number; width: number; height: number };
function docRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: Math.round(r.top + window.scrollY), left: Math.round(r.left + window.scrollX), width: Math.round(r.width), height: Math.round(r.height) };
}

/** 말풍선 자리: 기본은 오른쪽 아래. 목적지를 가리면 왼쪽 아래 → 오른쪽 위 → 왼쪽 위. */
export function bubbleSide(target: DOMRect, box: DOMRect, vw: number, vh: number, low: number, extra: DOMRect | null = null) {
  type Box = { left: number; right: number; top: number; bottom: number };
  const meets = (a: Box, r: Box) => a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top;
  // 목적지뿐 아니라 열려 있는 상담 창도 가리지 않는다.
  const hits = (r: Box) => meets(target, r) || (extra ? meets(extra, r) : false);
  const w = box.width;
  const h = box.height;
  const bottom = { top: vh - low - h, bottom: vh - low };
  const top = { top: 72, bottom: 72 + h };
  const right = { left: vw - 16 - w, right: vw - 16 };
  const left = { left: 16, right: 16 + w };
  const spots: [string, { left: number; right: number; top: number; bottom: number }][] = [
    ['', { ...right, ...bottom }],
    ['is-left', { ...left, ...bottom }],
    ['is-top', { ...right, ...top }],
    ['is-top is-left', { ...left, ...top }],
  ];
  return (spots.find(([, spot]) => !hits(spot)) ?? spots[0])[0];
}

/** 완주 결산. */
export function recap(done: string[], log: State['log'], course: Course) {
  const visited = COURSES[course].zones.flatMap((zone) => zone.ids).filter((id) => done.includes(id)).length;
  const lines = [{ big: `${visited}곳`, small: '불빛을 따라 들른 곳' }];
  if (log.risk) lines.push({ big: '찾았어요', small: '사기 글 속 위험 문장' });
  if (log.matched) lines.push({ big: '100점 만점', small: '근거와 함께 받은 전문가 추천' });
  lines.push({ big: `${log.asks ?? 0}번`, small: '풍이에게 직접 물어본 질문' });
  return lines;
}

/** 「풍이에게 묻기」: 말로 물으면 갈 곳을 고르고 한두 줄로 답한다(화면 설명에서만 답한다). */
const PAGES = [
  { words: ['에스크로', '대금', '돈', '안전', '결제', '환불'], path: '/mypage', place: '마이페이지', say: '대금은 결과물을 검수할 때까지 CREDO가 맡아 둬요. 진행 중인 프로젝트에서 단계를 볼 수 있어요.' },
  { words: ['등록', '의뢰', '맡기', '초안', '공고'], path: '/bounties/new', place: '프로젝트 등록', say: '한두 문장만 적으면 AI가 공고 초안을 채워요. 금액은 실제 정산 범위만 참고로 보여 줘요.' },
  { words: ['사기', '위험', '선입금', '카톡', '연락처'], path: '/bounties/new', place: '프로젝트 등록 · 위험 신호 점검', say: '글에 플랫폼 밖 거래·연락처 교환·선입금 요구가 있는지 문장을 짚어서 알려 줘요.' },
  { words: ['추천', '매칭', '전문가 찾', '누구', '고르'], path: '/matching', place: 'AI 매칭', say: '맡길 일을 적으면 평판·인증·경력·주제 적합도로 전문가를 100점 만점으로 추천해요.' },
  { words: ['상품', '가격', '얼마'], path: '/offers', place: '전문가 상품', say: '인증받은 전문가가 미리 올린 상품을 분야별로 볼 수 있어요.' },
  { words: ['사례', '후기', '분쟁', '성공률'], path: '/cases', place: '거래 사례', say: '정산이 끝난 거래가 분쟁·환불까지 빠짐없이 공개돼요.' },
  { words: ['지도', '동네', '지역', '근처'], path: '/map', place: '지역 찾기', say: '지도에서 동네 전문가와 프로젝트를 찾아요.' },
  { words: ['커뮤니티', '질문', '글'], path: '/community', place: '커뮤니티', say: '거래 후기·질문·사기 주의 글이 모여요.' },
  { words: ['지출', '예산', '인사이트', '통계'], path: '/insights', place: 'AI 인사이트', say: '내 지출을 분야별·월별로 정리해 보여 줘요.' },
  { words: ['인증', '자격'], path: '/certifications', place: '전문가 인증', say: '전문가는 자격 인증을 받아야 상품을 올리고 지역 찾기에 나와요.' },
];
export const ASK_IDEAS = ['내 돈은 언제 전문가에게 가?', '사기 글은 어떻게 걸러?', '전문가는 어떻게 골라?'];

export function answer(question: string) {
  const text = question.trim();
  if (!text) return null;
  const page = PAGES.find((item) => item.words.some((word) => text.includes(word)));
  if (page) return page;
  return { path: '/bounties', place: '프로젝트 둘러보기', say: '그건 제가 아직 길을 몰라요. 「프로젝트 둘러보기」에서 같이 찾아봐요.' };
}

function Face({ who, small = false }: { who: 'pung' | 'gyeol'; small?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={small ? 'guide-face is-small' : 'guide-face'} src={SPEAKERS[who].img} alt="" width={small ? 30 : 44} height={small ? 30 : 44} />
  );
}

function Lanterns({ course, current, done }: { course: Course; current: string | null; done: string[] }) {
  return (
    <div className="guide-lanterns" aria-label="진행">
      {COURSES[course].zones.map((zone) => (
        <span key={zone.name} className="guide-zone">
          {zone.ids.map((id) => (
            <i key={id} className={done.includes(id) ? 'is-lit' : id === current ? 'is-now' : ''} title={STEPS[id].place} />
          ))}
        </span>
      ))}
    </div>
  );
}

function AskForm({ onAsk }: { onAsk: (q: string) => void }) {
  const [text, setText] = useState('');
  return (
    <form className="guide-ask" onSubmit={(event) => { event.preventDefault(); if (text.trim()) onAsk(text.trim()); }}>
      <label htmlFor="guide-ask-input">풍이에게 묻기</label>
      <div>
        <span className="guide-ask-field">
          <input id="guide-ask-input" value={text} maxLength={80} onChange={(event) => setText(event.target.value)} placeholder="예: 내 돈은 언제 전문가에게 가?" />
        </span>
        <button type="submit" className="guide-ask-go" disabled={!text.trim()} aria-label="묻기">➜</button>
      </div>
      <div className="guide-ask-ideas" aria-label="이렇게 물어보세요">
        {ASK_IDEAS.map((idea) => (
          <button key={idea} type="button" onClick={() => { setText(idea); onAsk(idea); }}>{idea}</button>
        ))}
      </div>
    </form>
  );
}

export function GuideDuo({ tickMs = 450 }: { tickMs?: number }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<State>(EMPTY);
  const [asked, setAsked] = useState<{ question: string; answer: ReturnType<typeof answer> } | null>(null);
  const [view, setView] = useState<{ path: string; at: boolean; rect: Rect | null; reaction: string | null }>({ path: '/', at: false, rect: null, reaction: null });
  const [tried, setTried] = useState(false);
  const [side, setSide] = useState('');
  const targetRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLElement | null>(null);
  const scrolledFor = useRef('');

  useEffect(() => {
    setMounted(true);
    setState({ ...EMPTY, ...(readStore() ?? {}) });
  }, []);

  const ids = state.course ? courseIds(state.course) : [];
  const finished = Boolean(state.course) && state.index >= ids.length;
  const stepId = state.course && !finished ? ids[state.index] : null;
  const step = stepId ? STEPS[stepId] : null;
  const loggedIn = Boolean(user);

  const update = useCallback((patch: Partial<State> | ((current: State) => Partial<State>)) => {
    setState((current) => {
      const change = typeof patch === 'function' ? patch(current) : patch;
      if (!change || Object.keys(change).length === 0) return current;
      const next = { ...current, ...change };
      writeStore(next);
      return next;
    });
  }, []);

  const next = useCallback(() => {
    update((current) => {
      if (!current.course) return {};
      const list = courseIds(current.course);
      const id = list[current.index];
      const done = Array.from(new Set([...current.done, id, ...(SAME_PLACE[id] ? [SAME_PLACE[id]] : [])]));
      let index = current.index + 1;
      while (index < list.length && done.includes(list[index])) index += 1;
      return { index, done };
    });
  }, [update]);

  // 처음 온 사람(비로그인·데모 계정)에게 한 번만 인사한다. 닫으면 다시 띄우지 않는다.
  const greet = !loading && (!user || /@demo\.com$/.test(user.email ?? ''));
  useEffect(() => {
    if (!mounted || !greet || state.course || state.open) return undefined;
    const timer = setTimeout(() => { if (!greetedOnce()) update({ open: true }); }, 1400);
    return () => clearTimeout(timer);
  }, [mounted, greet]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setTried(false); }, [state.course, state.index]);

  useEffect(() => {
    if (!mounted) return undefined;
    function tick() {
      const loc = { path: window.location.pathname };
      // 입구: 이미 로그인돼 있으면 저절로 지나간다.
      if (stepId === 'entry' && loggedIn && !landingShown()) { next(); return; }
      if (!step) return;
      const detailHref = state.log.detail ?? null;
      const at = isAt(step, loc, detailHref);
      // 빛나는 곳을 눌러 다음 목적지로 왔으면 저절로 다음 걸음.
      if (!at && tried && state.course) {
        const list = courseIds(state.course);
        const following = list[state.index + 1] ? STEPS[list[state.index + 1]] : null;
        const nextHref = DETAIL_RE.test(loc.path) ? loc.path : detailHref;
        if (following && isAt(following, loc, nextHref)) {
          if (DETAIL_RE.test(loc.path)) update((current) => ({ log: { ...current.log, detail: loc.path } }));
          next();
          return;
        }
      }
      const el = at ? (step.target() as HTMLElement | null) : null;
      if (targetRef.current && targetRef.current !== el) delete targetRef.current.dataset.guideTarget;
      if (el) el.dataset.guideTarget = '1';
      targetRef.current = el;
      if (el && (stepId === 'escrow' || stepId === 'jEscrow')) {
        const href = el.getAttribute('href');
        if (href && href !== state.log.detail) update((current) => ({ log: { ...current.log, detail: href } }));
      }
      const rect = el ? docRect(el) : null;
      const reaction = at && step.react ? step.react() : null;
      if (at && (stepId === 'risk' || stepId === 'jRisk') && !state.log.risk && riskReaction()?.startsWith('찾았어요')) update((current) => ({ log: { ...current.log, risk: true } }));
      if (at && (stepId === 'match' || stepId === 'jMatch') && !state.log.matched && /1위 ·/.test(document.querySelector('main')?.textContent ?? '')) {
        update((current) => ({ log: { ...current.log, matched: true } }));
        setTried(true);
      }
      const box = bubbleRef.current?.getBoundingClientRect();
      const live = el?.getBoundingClientRect();
      const low = landingShown() ? 84 : 150;
      const chatPanel = document.querySelector('[data-guide="chat-panel"]')?.getBoundingClientRect() ?? null;
      if (box && live && box.width) setSide(bubbleSide(live, box, window.innerWidth, window.innerHeight, low, chatPanel));
      else if (!el) setSide('');
      setView((current) => {
        const same = current.path === loc.path && current.at === at && current.reaction === reaction && JSON.stringify(current.rect) === JSON.stringify(rect);
        return same ? current : { path: loc.path, at, rect, reaction };
      });
      const key = `${state.course}:${state.index}`;
      if (el && scrolledFor.current !== key) {
        scrolledFor.current = key;
        // 목적지를 화면 위쪽에 두되, 아래쪽 말풍선과 겹치지 않을 만큼 더 올린다(머리글 72px 아래까지).
        const r = el.getBoundingClientRect();
        const bh = bubbleRef.current?.getBoundingClientRect().height ?? 260;
        const room = window.innerHeight - low - bh - r.height - 24;
        const want = Math.max(72, Math.min(window.innerHeight * 0.2, room));
        window.scrollTo({ top: Math.max(0, window.scrollY + r.top - want), behavior: 'smooth' });
      }
    }
    tick();
    const timer = setInterval(tick, tickMs);
    return () => clearInterval(timer);
  }, [mounted, step, stepId, state.course, state.index, state.log, tried, loggedIn, tickMs, update, next, pathname]);

  // 빛나는 곳을 직접 누르면 「다음」이 켜진다.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const el = targetRef.current;
      if (el && event.target instanceof Node && el.contains(event.target)) setTried(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  function start(course: Course) {
    const list = courseIds(course);
    let index = 0;
    while (index < list.length && state.done.includes(list[index])) index += 1;
    setAsked(null);
    update({ course, index, open: true });
  }
  function back() { update((current) => ({ index: Math.max(1, current.index - 1) })); }
  function finish() { update({ course: null, index: 0, open: false }); }
  function onAsk(question: string) {
    update((current) => ({ log: { ...current.log, asks: (current.log.asks ?? 0) + 1 } }));
    setAsked({ question, answer: answer(question) });
  }
  function go(href: string) { window.location.assign(href); }
  function goThere() {
    if (!step) return;
    if (step.landing) { go('/'); return; }
    if (step.detail) { go(state.log.detail ?? DETAIL_FALLBACK); return; }
    if (step.path) go(step.path);
  }

  if (!mounted) return null;

  const reacted = Boolean(view.reaction);
  const acted = tried || reacted || Boolean(step?.look);
  const zone = step && state.course ? COURSES[state.course].zones.find((z) => z.ids.includes(stepId as string)) : null;
  const position = step && zone ? `${zone.ids.indexOf(stepId as string) + 1} / ${zone.ids.length}` : '';
  const onLanding = landingShown();

  let body: ReactNode = null;
  if (state.open && asked?.answer) {
    const a = asked.answer;
    body = (
      <>
        <header className="guide-who">
          <Face who="pung" />
          <div><strong>풍이</strong><small>화면 설명에서 찾았어요</small></div>
          <button type="button" className="guide-x" aria-label="안내 접기" onClick={() => update({ open: false })}>×</button>
        </header>
        <p className="guide-asked">“{asked.question}”</p>
        <p className="guide-say" aria-live="polite">{a.say}</p>
        <div className="guide-actions">
          <button type="button" className="guide-glow" onClick={() => { setAsked(null); go(a.path); }}>「{a.place}」에 데려다 드릴게요</button>
        </div>
        <div className="guide-links">
          <button type="button" className="guide-link" onClick={() => setAsked(null)}>{state.course ? '길 안내로 돌아가기' : '다른 것 묻기'}</button>
        </div>
        <AskForm onAsk={onAsk} />
      </>
    );
  } else if (state.open && !state.course) {
    body = (
      <>
        <header className="guide-who">
          <span className="guide-faces"><Face who="pung" /><Face who="gyeol" /></span>
          <div><strong>풍이와 결이</strong><small>CREDO 길 안내</small></div>
          <button type="button" className="guide-x" aria-label="안내 접기" onClick={() => update({ open: false })}>×</button>
        </header>
        <p className="guide-say">처음이세요? 불빛을 따라 CREDO를 둘러보세요.</p>
        <div className="guide-actions is-choice">
          <button type="button" className="guide-glow" onClick={() => start('short')}>3분 간략<small>핵심 네 곳</small></button>
          <button type="button" className="guide-glow is-soft" onClick={() => start('long')}>10분 자세히<small>4구역 열두 곳</small></button>
          <button type="button" className="guide-glow is-soft is-wide" onClick={() => start('judge')}>평가자용 빠른 코스<small>5분 · 면접관·선생님께 · AI와 돈을 믿을 수 있게 만든 다섯 곳</small></button>
        </div>
        <button type="button" className="guide-link" onClick={() => update({ open: false })}>나중에 볼게요</button>
        <AskForm onAsk={onAsk} />
      </>
    );
  } else if (state.open && finished && state.course) {
    const short = state.course === 'short';
    const judge = state.course === 'judge';
    body = (
      <>
        <header className="guide-who">
          <span className="guide-faces"><Face who="pung" /><Face who="gyeol" /></span>
          <div><strong>풍이와 결이</strong><small>{COURSES[state.course].name} 완주</small></div>
        </header>
        <Lanterns course={state.course} current={null} done={state.done} />
        <div className="guide-recap" aria-label="오늘의 CREDO 길 결산">
          <p className="guide-recap-title">오늘의 CREDO 길 결산</p>
          {recap(state.done, state.log, state.course).map((line) => <div key={line.small}><b>{line.big}</b><span>{line.small}</span></div>)}
        </div>
        <p className="guide-say">
          {judge
            ? '평가자용 코스 끝! 상태 전이·행 잠금·AI 검증 코드와 테스트는 GitHub에 있어요.'
            : short
              ? '3분 길 안내 끝! 핵심 네 곳을 다 들렀어요. 10분 자세히 코스가 열렸어요.'
              : '4구역을 모두 돌았어요! 오른쪽 아래 풍이를 누르면 언제든 다시 안내해요.'}
        </p>
        <div className="guide-actions">
          {judge && <a className="guide-glow" href="https://github.com/nlsjjy84-ui/vouchsafe" target="_blank" rel="noreferrer">GitHub 열기</a>}
          {(short || judge) && <button type="button" className={judge ? 'guide-glow is-soft' : 'guide-glow'} onClick={() => start('long')}>{judge ? '나머지 기능 이어 보기(10분 코스)' : '10분 자세히 이어 가기'}</button>}
          <button type="button" className="guide-link" onClick={finish}>{short || judge ? '여기까지 볼게요' : '안내 닫기'}</button>
        </div>
      </>
    );
  } else if (state.open && step && state.course) {
    const offRoute = !view.at;
    const text = offRoute
      ? `지금은 ${step.landing ? '다른 화면' : placeName(view.path)}에 계세요. 다음 목적지는 ${iyeyo(`「${step.place}」`)}.`
      : view.reaction ?? (tried && step.after ? step.after : step.say);
    body = (
      <>
        <header className="guide-who">
          <Face who={step.who} />
          <div><strong>{SPEAKERS[step.who].name}</strong><small>{stepId === 'entry' ? '입구' : `${COURSES[state.course].name} · ${zone?.name} ${position}`}</small></div>
          <button type="button" className="guide-x" aria-label="안내 접기" onClick={() => update({ open: false })}>×</button>
        </header>
        {stepId !== 'entry' && <Lanterns course={state.course} current={stepId} done={state.done} />}
        <p className="guide-say" aria-live="polite">{text}</p>
        {!offRoute && step.note && <p className="guide-note">{step.note}</p>}
        {!offRoute && !view.rect && <p className="guide-note">화면을 불러오는 중이에요. 무료 서버라 처음엔 10~20초쯤 걸릴 수 있어요.</p>}
        <div className="guide-actions">
          {offRoute && <button type="button" className="guide-glow" onClick={goThere}>데려다 드릴게요</button>}
          {!offRoute && step.fill && !tried && !reacted && <button type="button" className="guide-glow is-soft" onClick={() => fillInput(step.fill!.selector, step.fill!.value)}>대신 적어 드릴게요</button>}
          {!offRoute && acted && stepId !== 'entry' && <button type="button" className="guide-glow" onClick={next}>다음</button>}
          {!offRoute && !acted && <span className="guide-hint">빛나는 곳을 눌러 보세요</span>}
        </div>
        <div className="guide-links">
          {state.index > 1 && <button type="button" className="guide-link" onClick={back}>이전</button>}
          {stepId !== 'entry' && !acted && <button type="button" className="guide-link" onClick={next}>건너뛰기</button>}
          <button type="button" className="guide-link" onClick={finish}>안내 끝내기</button>
        </div>
      </>
    );
  }

  const showLight = Boolean(step) && view.at && view.rect && !finished;
  const rect = view.rect;
  const ui = (
    <div className={`guide-root${onLanding ? ' on-landing' : ''}${loggedIn && !onLanding ? ' has-chat' : ''}`}>
      {showLight && rect && state.open && <div className="guide-spot" aria-hidden="true" style={{ top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 }} />}
      {showLight && rect && <div className="guide-halo" aria-hidden="true" style={{ top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 }} />}
      {showLight && rect && <span className="guide-orb" aria-hidden="true" style={{ top: rect.top - 9, left: rect.left + rect.width - 9 }} />}
      {body && <section ref={bubbleRef} className={`guide-bubble ${side}`} role="dialog" aria-label="풍이와 결이의 길 안내">{body}</section>}
      <button
        type="button"
        className={`guide-launcher${state.course && !state.open ? ' is-waiting' : ''}`}
        aria-expanded={state.open}
        aria-label="풍이와 결이의 길 안내"
        onClick={() => update((current) => ({ open: !current.open }))}
      >
        <Face who="pung" small />
        <span>{state.course && !finished ? '이어서 안내' : '길 안내'}</span>
      </button>
    </div>
  );
  return createPortal(ui, document.body);
}

const CLICKABLE = 'a, button, [role="button"], summary, label, select, input[type="checkbox"], input[type="radio"]';

/** 등불 커서: 기본 화살표 뒤를 작은 불빛이 따라오고, 길 안내 목적지 위에서는 풍이가 "여기예요!" 한다. */
export function LanternCursor() {
  const lightRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    if (!window.matchMedia('(pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const light = lightRef.current;
    if (!light) return undefined;
    let x = -100, y = -100, tx = -100, ty = -100, frame = 0, shown = false;
    const loop = () => {
      x += (tx - x) * 0.2;
      y += (ty - y) * 0.2;
      light.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      frame = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(loop) : 0;
    };
    const onMove = (event: PointerEvent) => {
      tx = event.clientX; ty = event.clientY;
      if (!shown) { shown = true; x = tx; y = ty; light.classList.add('is-on'); }
      const target = event.target as Element | null;
      light.classList.toggle('is-over', Boolean(target?.closest?.(CLICKABLE)));
      light.classList.toggle('is-guide', Boolean(target?.closest?.('[data-guide-target]')));
      if (!frame) frame = requestAnimationFrame(loop);
    };
    const onLeave = () => { shown = false; light.classList.remove('is-on'); };
    const onDown = () => light.classList.add('is-press');
    const onUp = () => light.classList.remove('is-press');
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);
  return (
    <span ref={lightRef} className="lantern-cursor" aria-hidden="true">
      <i />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <b><img src="/guide/pung.webp" alt="" width={22} height={22} />여기예요!</b>
    </span>
  );
}
