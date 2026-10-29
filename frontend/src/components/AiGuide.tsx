'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth-context';
import { createAiGuide } from '@/lib/aiGuide';
import { STEPS, COURSES, SAME_PLACE, courseIds, isAt, fillInput, iyeyo, placeName, recap, answer } from './GuideDuo';

/**
 * =========================================================================
 * AI 길 안내 (2026-10-29 새 모양)
 * =========================================================================
 * 풍이·결이 그림과 말풍선 상자를 걷어내고, 화면에 보이는 모양만 바꿨다. 코스(3분·10분·평가자용)와
 * 걸음(STEPS)·위험 점검 반응은 GuideDuo의 것을 그대로 쓴다.
 * - 마우스 화살표 대신 꺾쇠 커서가 버튼을 찰칵 잡아 주고, 커서가 다가가면 가까운 버튼 글씨가 커진다.
 * - 커서 뒤로 따뜻한 주황 빛줄기가 짧게 감싸며 따라온다(에스크로가 맡긴 돈을 감싸 지키는 느낌).
 * - 설명은 상자 없이 빛나는 글씨로 짚은 버튼 옆에만 뜬다. 밝은 바탕에서는 진한 글씨로 바뀐다.
 * - 아무것도 가리거나 막지 않는다. 엉뚱한 곳을 눌러도 그 화면은 그대로 쓰고, 안내만 다시 짚는다.
 * =========================================================================
 */

type Course = keyof typeof COURSES;
type GuideState = { course: Course | null; index: number; done: string[]; log: { detail?: string; risk?: boolean; matched?: boolean; asks?: number } };
type Guide = ReturnType<typeof createAiGuide>;

const STORE_KEY = 'credo-guide-v2';
const GREETED_KEY = 'credo-guide-greeted';
const DETAIL_FALLBACK = '/bounties/88d13c82-7057-4b34-a4ab-12bb6b740f28';
const DETAIL_RE = /^\/bounties\/[0-9a-fA-F-]{36}$/;
const ACCENT = ['#f08a4b', '#f5c26b', '#e45d3a', '#ffd9a8'];
const EMPTY: GuideState = { course: null, index: 0, done: [], log: {} };

/** 메뉴·버튼에 마우스가 머물면 한 줄로 알려 줄 말(화면 설명과 같은 말). */
export const LINK_TEXT: Record<string, string> = {
  '/bounties': '모집 중인 프로젝트를 분야·금액·지역으로 둘러봐요.',
  '/offers': '자격을 인증받은 전문가가 미리 올려 둔 상품이에요.',
  '/cases': '정산이 끝난 거래가 분쟁·환불까지 빠짐없이 자동으로 공개돼요.',
  '/map': '우리 동네 전문가를 지도로 찾아요. 위치는 동 단위까지만 저장해요.',
  '/community': '거래 후기·질문·사기 주의 글이 모여요.',
  '/matching': '맡길 일을 적으면 평판·인증·경력·주제 적합도로 전문가를 100점 만점으로 추천해요.',
  '/insights': '내 지출을 분야별·월별로 정리하고 눈에 띄는 점을 짚어 줘요.',
  '/bounties/new': '한두 문장만 적으면 AI가 공고 초안을 채우고, 사기 신호를 문장 그대로 짚어 줘요.',
  '/certifications': '전문가는 자격을 증명해야 지원하고 상품을 올릴 수 있어요.',
  '/mypage': '내 프로젝트와 에스크로 상태(대금이 어디에 있는지)를 한눈에 봐요.',
};

export function guideText(el: Element): { title: string; text: string } | null {
  if (!el.matches) return null;
  const name = (el.textContent ?? '').trim().replace(/\s+/g, ' ');
  if (el.matches('.vs-landing-action')) return { title: name || '둘러보기', text: '가입 없이 공용 데모 계정으로 들어가요. AI 초안·위험 점검·매칭까지 다 써 볼 수 있어요.' };
  if (el.matches('a[href]')) {
    const href = (el.getAttribute('href') ?? '').split('?')[0];
    if (LINK_TEXT[href]) return { title: name.slice(0, 24) || href, text: LINK_TEXT[href] };
    if (DETAIL_RE.test(href)) return { title: name.slice(0, 24) || '프로젝트', text: '이 프로젝트의 요구사항 체크리스트·에스크로 단계·안심번호를 봐요.' };
  }
  if (el.matches('button')) {
    if (/AI 챗봇 열기/.test(el.getAttribute('aria-label') ?? '')) return { title: '상담', text: '에스크로·수수료·분쟁을 바로 물어볼 수 있어요.' };
    if (/초안 만들기/.test(name)) return { title: name, text: '적은 한두 문장으로 분야·제목·상세 내용을 채워요. 금액은 AI가 정하지 않아요.' };
    if (/위험 신호 점검|다시 점검/.test(name)) return { title: name, text: '외부 연락·선입금 같은 사기 신호를 문장 그대로 짚어요. 글에 없는 문장을 지어내면 서버가 버려요.' };
    if (/전문가 추천받기/.test(name)) return { title: name, text: '평판·인증·경력은 서버가 거래 기록으로 계산하고, AI는 주제 적합도만 매겨요.' };
    if (/의뢰인으로 둘러보기|전문가로 둘러보기/.test(name)) return { title: name, text: '가입 없이 공용 데모 계정으로 이 화면을 이어서 써 봐요.' };
  }
  return null;
}

export function whereNow() {
  if (typeof window === 'undefined') return '';
  if (document.querySelector('.vs-landing-action')) return '첫 화면';
  return placeName(window.location.pathname);
}

function read(): GuideState { try { return { ...EMPTY, ...(JSON.parse(window.sessionStorage.getItem(STORE_KEY) ?? 'null') ?? {}) }; } catch { return EMPTY; } }
function write(state: GuideState) { try { window.sessionStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* 이 화면에서만 기억 */ } }

export function advance(state: GuideState): GuideState {
  if (!state.course) return state;
  const list = courseIds(state.course);
  const id = list[state.index];
  const done = Array.from(new Set([...state.done, id, ...(SAME_PLACE[id] ? [SAME_PLACE[id]] : [])]));
  let index = state.index + 1;
  while (index < list.length && done.includes(list[index])) index += 1;
  return { ...state, index, done };
}
export function startCourse(state: GuideState, course: Course): GuideState {
  const list = courseIds(course);
  let index = 0;
  while (index < list.length && state.done.includes(list[index])) index += 1;
  return { ...state, course, index };
}

// 코스는 하나: 「데모 둘러보기」(예전 10분 코스). 3분·10분·평가자용으로 나누지 않는다.
export const TOUR: Course = 'long';
export const TOUR_NAME = '데모 둘러보기';
const QUIET_KEY = 'credo-guide-quiet';
export function readQuiet(): boolean { try { return window.sessionStorage.getItem(QUIET_KEY) === '1'; } catch { return false; } }
export function writeQuiet(on: boolean) { try { if (on) window.sessionStorage.setItem(QUIET_KEY, '1'); else window.sessionStorage.removeItem(QUIET_KEY); } catch { /* 이 화면에서만 */ } }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function AiGuide() {
  const { user, loading } = useAuth();
  const guideRef = useRef<Guide | null>(null);
  const runningRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ask, setAsk] = useState('');
  const [quiet, setQuietState] = useState(false); // 「설명 없이 둘러볼게요」: 설명 글만 끄고 커서·빛은 그대로
  const explainOnRef = useRef(false); // 설명은 처음 온 사람(비로그인·데모)과 코스 중일 때만. 효과는 누구에게나 늘 켠다.

  useEffect(() => {
    setMounted(true);
    const g = createAiGuide({ name: 'CREDO AI', accent: ACCENT, effect: 'glow', calm: true, trail: 14, inkStrong: '#9a3d12', explain: (el: Element) => (explainOnRef.current || read().course ? guideText(el) : null), where: whereNow,
      hud: () => explainOnRef.current || Boolean(read().course), onQuit: () => { write({ ...read(), course: null, index: 0 }); explainOnRef.current = false; } });
    guideRef.current = g;
    return () => { g.stop(); guideRef.current = null; };
  }, []);

  async function drive() {
    const g = guideRef.current;
    if (!g || runningRef.current) return;
    runningRef.current = true;
    try {
      let state = read();
      while (state.course && state.index < courseIds(state.course).length) {
        const id = courseIds(state.course)[state.index];
        const step = STEPS[id];
        const path = window.location.pathname;
        if (id === 'entry' && user && !document.querySelector('.vs-landing-action')) { state = advance(state); write(state); continue; }
        if (step.skip?.()) { state = advance(state); write(state); continue; }
        if (!isAt(step, { path }, state.log.detail ?? null)) {
          const go = await g.speak(`지금은 ${placeName(path)}에 계세요. 다음 목적지는 ${iyeyo(`「${step.place}」`)}.`,
            { kicker: 'CREDO AI · 길 안내', buttons: [{ label: '데려다 드릴게요', value: 'go', main: true }, { label: '안내 끝내기', value: 'end' }] });
          if (go === 'end') { write({ ...state, course: null, index: 0 }); return; }
          const href = step.landing ? '/' : step.detail ? (state.log.detail ?? DETAIL_FALLBACK) : (step.path ?? '/');
          window.location.assign(href); return;
        }
        const zone = COURSES[state.course].zones.find((z) => z.ids.includes(id));
        const where = id === 'entry' ? '입구' : `${TOUR_NAME} · ${zone?.name ?? ''} ${zone ? `${zone.ids.indexOf(id) + 1}/${zone.ids.length}` : ''}`;
        let clicked: Element | null = null;
        const ok = await g.point({
          target: () => { clicked = step.target(); return clicked; }, say: step.say, look: step.look, react: step.react, after: step.after, label: step.place,
          fill: step.fill ? () => fillInput(step.fill!.selector, step.fill!.value) : undefined,
        }, where);
        if (!ok) await g.speak('화면을 불러오는 중이라 이 걸음은 건너뛸게요.', { kicker: 'CREDO AI' });
        const href = (clicked as Element | null)?.getAttribute?.('href');
        if ((id === 'escrow' || id === 'jEscrow') && href && DETAIL_RE.test(href)) state = { ...state, log: { ...state.log, detail: href } };
        if ((id === 'risk' || id === 'jRisk') && /찾았어요/.test(step.react?.() ?? '')) state = { ...state, log: { ...state.log, risk: true } };
        if ((id === 'match' || id === 'jMatch') && /1위 ·/.test(document.querySelector('main')?.textContent ?? '')) state = { ...state, log: { ...state.log, matched: true } };
        state = advance(state); write(state);
        await sleep(700); // 눌러서 다른 화면으로 넘어가는 중이면 자리 잡을 시간을 준다
      }
      if (state.course) {
        const lines = recap(state.done, state.log, state.course).filter((line) => !line.small.includes('풍이'));
        await g.speak(`<b>${TOUR_NAME} 끝!</b> ${lines.map((l) => `${l.big} ${l.small}`).join(' · ')}. 이제 마음대로 눌러 보세요. 아무 메뉴에나 마우스를 올리면 무엇인지 바로 알려 드려요.`,
          { kicker: 'CREDO AI · 오늘의 길 결산', buttons: [{ label: '마음대로 둘러볼게요', value: 'end', main: true }] });
        write({ ...state, course: null, index: 0 });
      }
    } finally { runningRef.current = false; }
  }

  function setQuiet(on: boolean) { writeQuiet(on); setQuietState(on); explainOnRef.current = greet && !on; }
  function choose(course: Course) { setMenuOpen(false); setQuiet(false); write(startCourse(read(), course)); drive(); }
  useEffect(() => { setQuietState(readQuiet()); }, []);

  const greet = !loading && (!user || /@demo\.com$/.test(user.email ?? ''));
  explainOnRef.current = greet && !quiet;
  useEffect(() => {
    if (!mounted) return undefined;
    const timer = setTimeout(() => {
      if (read().course) { drive(); return; }
      if (!greet) return;
      try { if (window.sessionStorage.getItem(GREETED_KEY) === '1') return; window.sessionStorage.setItem(GREETED_KEY, '1'); } catch { /* 한 번만 */ }
      setMenuOpen(true);
    }, 1400);
    return () => clearTimeout(timer);
  }, [mounted, greet]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onAsk(event: React.FormEvent) {
    event.preventDefault();
    const q = ask.trim();
    const g = guideRef.current;
    if (!q || !g) return;
    setAsk(''); setMenuOpen(false);
    const found = answer(q);
    if (!found) return;
    const go = await g.speak(found.say, { kicker: 'CREDO AI · 길 묻기', buttons: [{ label: `「${found.place}」로 데려다 드릴게요`, value: 'go', main: true }, { label: '괜찮아요', value: 'no' }] });
    if (go === 'go') window.location.assign(found.path);
  }

  useEffect(() => { document.documentElement.classList.toggle('aig-menu-open', menuOpen); return () => document.documentElement.classList.remove('aig-menu-open'); }, [menuOpen]);

  if (!mounted) return null;
  const resume = read().course;
  if (!greet && !resume) return null; // 실제 사용자에게는 「길 안내」 글자도 띄우지 않는다(효과만 남는다)
  return createPortal(
    <div className="aig-launch-wrap">
      {menuOpen && (
        <div className="aig-menu" role="dialog" aria-label="CREDO 길 안내">
          <p className="aig-menu-q">처음이세요? CREDO를 둘러볼까요?</p>
          <button type="button" onClick={() => choose(TOUR)}>데모 둘러보기<small>처음부터 끝까지 같이 걸어요 · 언제든 그만 볼 수 있어요</small></button>
          <button type="button" className="aig-menu-quiet" onClick={() => { setQuiet(true); setMenuOpen(false); guideRef.current?.speak('설명은 끌게요. 마음대로 둘러보세요. 다시 보고 싶으면 오른쪽 위 「✦ 데모 길 안내 켜기」를 누르세요.', { kicker: 'CREDO AI' }); }}>설명 없이 둘러볼게요<small>설명 글은 끄고 바로 써 보기</small></button>
          <form className="aig-ask" onSubmit={onAsk}>
            <label htmlFor="aig-ask-input">AI에게 길 묻기</label>
            <input id="aig-ask-input" value={ask} maxLength={120} onChange={(e) => setAsk(e.target.value)} placeholder="예: 내 돈은 언제 전문가에게 가?" />
          </form>
          <button type="button" className="aig-menu-later" onClick={() => setMenuOpen(false)}>나중에 볼게요</button>
        </div>
      )}
      <button type="button" className="aig-launch" aria-expanded={menuOpen} onClick={() => { if (resume && !menuOpen) { drive(); return; } if (quiet) setQuiet(false); setMenuOpen((open) => !open); }}>
        ✦ {resume ? '이어서 안내' : quiet ? '데모 길 안내 켜기' : '데모 길 안내'}
      </button>
    </div>,
    document.body,
  );
}
