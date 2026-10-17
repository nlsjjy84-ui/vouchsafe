'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { useAuth } from '@/lib/auth-context';
import { JangdanMark } from '@/components/JangdanMark';
import { DOMAIN_LABELS } from '@/lib/types';
import type { JangdanScene } from './JangdanScene';
import { jangdanName } from './JangdanScene';

export interface LandingStats {
  trust: { verifiedExperts: number; rejected: number };
  settled: { count: number; amount: number; refunded: number };
  offers: { active: number };
}

/**
 * 첫 화면(로그아웃 상태) — 스크롤하면 다음 화면으로 넘어가며 계속 모습이 바뀐다.
 * 뒤에는 3D 장단 기둥(JangdanScene)이 늘 박자를 치고, 화면마다 자리 · 대형 · 빠르기가 바뀐다.
 * 화면: 첫 화면 → 문제(글 오른쪽) → 에스크로(가운데) → 자격 · 이력 · 신원(가로로 넘어감) → 승인 → 숫자 → 15개 분야 → 마지막
 * 도구: Lenis(매끄러운 스크롤) + GSAP ScrollTrigger(글 등장) + three.js. 숫자는 /stats/home 실제 값.
 */

const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const smooth = (n: number) => {
  n = clamp(n);
  return n * n * (3 - 2 * n);
};
function bigWon(n: number): { value: number; unit: string } {
  if (n >= 100_000_000) return { value: Math.round(n / 10_000_000) / 10, unit: '억 원' };
  if (n >= 10_000) return { value: Math.round(n / 10_000), unit: '만 원' };
  return { value: n, unit: '원' };
}

// 화면마다 3D 장면이 맡는 구간과 자리(-0.19 오른쪽 · 0 가운데 · 0.19 왼쪽)
type Sec = { id: string; scene: [number, number]; shift: number; veil: 'left' | 'right' | 'center' };
const SECTIONS: Sec[] = [
  { id: 'hero', scene: [0, 0.13], shift: -0.19, veil: 'left' },
  { id: 'problem', scene: [0.13, 0.33], shift: 0.19, veil: 'right' },
  { id: 'escrow', scene: [0.33, 0.52], shift: 0, veil: 'center' },
  { id: 'checks', scene: [0.52, 0.7], shift: -0.28, veil: 'left' },
  { id: 'approve', scene: [0.7, 0.87], shift: -0.19, veil: 'left' },
  { id: 'numbers', scene: [0.87, 0.9], shift: 0, veil: 'center' },
  { id: 'fields', scene: [0.9, 0.93], shift: 0, veil: 'center' },
  { id: 'final', scene: [0.93, 1], shift: 0, veil: 'center' },
];

const HEARD = ['“선금 먼저 보내 주시면 바로 시작할게요”', '“여기 말고 메신저로 연락 주세요”', '“자격증은 일 끝나고 보여 드릴게요”'];

const CHECKS = [
  { no: '01', word: '자격', text: '자격증 번호와 증빙을 내면 형식 검증과 원본 대조를 거쳐요. 통과한 분야의 일에만 지원할 수 있어요.' },
  { no: '02', word: '이력', text: '사업자 경력, 실무 경력·강의 이력도 같은 방식으로 대조해요. 반려된 건수도 숨기지 않아요.' },
  { no: '03', word: '신원', text: '연락처는 안심번호로 가리고, 정산 계좌는 회원 본인 이름이어야 해요. 한 계좌를 여럿이 쓸 수 없어요.' },
];

export function JangdanLanding({ stats }: { stats: LandingStats | null }) {
  const { demoLogin } = useAuth();
  const root = useRef<HTMLDivElement>(null);
  const sceneEl = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const rhythmRef = useRef<HTMLSpanElement>(null);
  const secRefs = useRef<(HTMLElement | null)[]>([]);
  const heardRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const countRefs = useRef<(HTMLElement | null)[]>([]);
  const scene = useRef<JangdanScene | null>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [activeSec, setActiveSec] = useState(0);
  const [busy, setBusy] = useState<null | 'client' | 'expert'>(null);
  const [demoError, setDemoError] = useState(false);

  // 3D 장면(브라우저 · WebGL이 있을 때만)
  useEffect(() => {
    let disposed = false;
    const el = sceneEl.current;
    if (!el) return undefined;
    const probe = document.createElement('canvas');
    if (!(probe.getContext && (probe.getContext('webgl2') || probe.getContext('webgl')))) return undefined;
    import('./JangdanScene')
      .then(({ JangdanScene }) => {
        if (disposed) return;
        scene.current = new JangdanScene(el);
        scene.current.start();
        setReady(true);
      })
      .catch(() => {});
    return () => {
      disposed = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    if (scene.current) scene.current.paused = paused;
  }, [paused, ready]);

  // 스크롤: Lenis로 매끄럽게, 화면마다 장면 구간 · 자리를 정하고, 글은 GSAP으로 맺히며 들어온다
  useEffect(() => {
    const reduced = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    setPaused(reduced);
    gsap.registerPlugin(ScrollTrigger);
    const lenis = reduced ? null : new Lenis({ lerp: 0.085, smoothWheel: true });
    let target = 0;
    let current = 0;
    let shown = -1;
    let lastRhythm = '';
    const counted: number[] = [];

    const read = () => {
      const vh = window.innerHeight;
      const mid = vh * 0.5;
      let idx = 0;
      let local = 0;
      secRefs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.top <= mid) {
          idx = i;
          // 가로로 넘어가는 화면은 고정된 동안의 진행도로 맞춘다
          local = SECTIONS[i].id === 'checks' ? clamp(-r.top / Math.max(1, r.height - vh)) : clamp((mid - r.top) / Math.max(1, r.height));
        }
      });
      const sec = SECTIONS[idx];
      target = sec.scene[0] + (sec.scene[1] - sec.scene[0]) * local;
      if (scene.current) scene.current.shift = sec.shift;
      if (idx !== shown) {
        shown = idx;
        setActiveSec(idx);
        if (veilRef.current) veilRef.current.dataset.side = sec.veil;
      }
      // 문제: 들은 말이 스크롤만큼 한 줄씩 쳐진다
      const prob = secRefs.current[1];
      if (prob) {
        const r = prob.getBoundingClientRect();
        const k = clamp((vh * 0.75 - r.top) / Math.max(1, r.height - vh * 0.2));
        HEARD.forEach((full, i) => {
          const el = heardRefs.current[i];
          if (!el) return;
          const part = clamp(k * 3.2 - i * 0.95);
          const text = full.slice(0, Math.round(full.length * part));
          if (el.dataset.t !== text) {
            el.dataset.t = text;
            el.textContent = text;
          }
          el.style.opacity = String(part > 0 ? 1 : 0);
        });
      }
      // 자격 · 이력 · 신원: 세로 스크롤만큼 가로로 넘어간다
      const checks = secRefs.current[3];
      const track = trackRef.current;
      if (checks && track) {
        const r = checks.getBoundingClientRect();
        const k = clamp(-r.top / Math.max(1, r.height - vh));
        track.style.transform = `translate3d(${-k * (track.scrollWidth - window.innerWidth)}px, 0, 0)`;
      }
      // 숫자: 화면에 들어오면 0에서 실제 값까지
      const nums = secRefs.current[5];
      if (nums) {
        const r = nums.getBoundingClientRect();
        const k = smooth((vh * 0.85 - r.top) / (vh * 0.6));
        countRefs.current.forEach((el, i) => {
          if (!el) return;
          const val = Math.round(Number(el.dataset.to || 0) * smooth(k * 1.3 - i * 0.12));
          if (counted[i] !== val) {
            counted[i] = val;
            el.textContent = val.toLocaleString('ko-KR');
          }
        });
      }
    };

    let lastTime = -1;
    const tick = (time: number) => {
      lenis?.raf(time * 1000);
      read();
      const dt = lastTime < 0 ? 0 : Math.min(0.1, time - lastTime);
      lastTime = time;
      current += (target - current) * (reduced ? 1 : 1 - Math.exp(-dt * 5));
      if (scene.current) scene.current.progress = current;
      const name = jangdanName(current);
      if (name !== lastRhythm && rhythmRef.current) {
        lastRhythm = name;
        rhythmRef.current.textContent = name;
      }
    };
    if (lenis) lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // 글 등장: 화면에 들어올 때 흐릿하게 아래에서 맺힌다, 나갈 때는 거꾸로
    const reveals = gsap.utils.toArray<HTMLElement>('[data-reveal]', root.current);
    const first = secRefs.current[0];
    const tweens = reveals.map((el) =>
      first?.contains(el)
        ? // 첫 화면 글은 스크롤을 기다리지 않고 바로 맺힌다
          gsap.fromTo(
            el,
            { autoAlpha: 0, y: 40, filter: reduced ? 'none' : 'blur(12px)' },
            { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out', delay: 0.25 + Number(el.dataset.reveal || 0) * 0.15 },
          )
        : gsap.fromTo(
        el,
        { autoAlpha: 0, y: 60, filter: reduced ? 'none' : 'blur(12px)' },
        {
          autoAlpha: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 1.1,
          ease: 'power3.out',
          delay: Number(el.dataset.reveal || 0) * 0.12,
          scrollTrigger: { trigger: el, start: 'top 85%', end: 'bottom 10%', toggleActions: 'play reverse play reverse' },
        },
      ),
    );
    return () => {
      gsap.ticker.remove(tick);
      tweens.forEach((tw) => {
        tw.scrollTrigger?.kill();
        tw.kill();
      });
      lenis?.destroy();
    };
  }, []);

  async function demo(role: 'client' | 'expert') {
    setBusy(role);
    setDemoError(false);
    try {
      await demoLogin(role);
      window.location.assign(role === 'client' ? '/mypage' : '/bounties');
    } catch {
      setDemoError(true);
    } finally {
      setBusy(null);
    }
  }

  const actions = (last: boolean) => (
    <div className="vs-landing-actions" data-reveal="3">
      <button type="button" className="vs-landing-action" onClick={() => demo('client')} disabled={busy !== null}>
        <span>{busy === 'client' ? '들어가는 중…' : '의뢰인으로 둘러보기'}</span>
        <i aria-hidden="true">↗</i>
      </button>
      <button type="button" className="vs-landing-link" onClick={() => demo('expert')} disabled={busy !== null}>
        {busy === 'expert' ? '들어가는 중…' : '전문가로 둘러보기'}
      </button>
      <Link className="vs-landing-link" href={last ? '/register' : '/offers'}>
        {last ? '회원가입' : '전문가 상품 보기'}
      </Link>
    </div>
  );

  const s = stats;
  const amount = s ? bigWon(s.settled.amount) : null;
  const NUMBERS = s
    ? [
        { to: s.trust.verifiedExperts, unit: '명', label: '서류 대조를 통과한 전문가', note: `반려 ${s.trust.rejected}건도 공개` },
        { to: s.settled.count, unit: '건', label: '승인까지 끝나 정산된 거래', note: `환불 ${s.settled.refunded}건도 공개` },
        { to: amount!.value, unit: amount!.unit, label: '에스크로를 거쳐 정산된 금액', note: '승인한 뒤에만 지급' },
      ]
    : [];
  const ref = (i: number) => (el: HTMLElement | null) => {
    secRefs.current[i] = el;
  };

  return (
    <div className="vs-landing" ref={root}>
      <div className="vs-landing-stage" aria-hidden="true">
        <div className="vs-landing-backdrop" />
        <div ref={sceneEl} className={`vs-landing-scene${ready ? ' is-ready' : ''}`} />
        <div ref={veilRef} className="vs-landing-veil" data-side="left" />
      </div>

      <header className="vs-landing-masthead">
        <Link className="vs-landing-brand" href="/" aria-label="Vouchsafe 처음으로">
          <JangdanMark size={20} variant="dark" />
          <span>Vouchsafe</span>
        </Link>
        <nav className="vs-landing-top" aria-label="둘러보기">
          <Link href="/offers">전문가 상품</Link>
          <Link href="/cases">거래 사례</Link>
          <Link href="/login">로그인</Link>
          <Link href="/register" className="vs-landing-top-strong">
            회원가입 <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </header>

      <div className="vs-landing-flow">
        <section ref={ref(0)} className="vs-sec vs-sec-hero">
          <div className="vs-col">
            <h1 data-reveal="0">
              맡기기 전에,
              <br />
              먼저 확인합니다
            </h1>
            <p data-reveal="1">자격을 검증한 전문가, 승인해야 정산되는 대금.</p>
            {actions(false)}
            {demoError && (
              <p className="vs-landing-note" role="status">
                지금은 둘러보기에 들어갈 수 없어요. 서버가 깨어나는 중일 수 있으니 잠시 후 다시 눌러 주세요.
              </p>
            )}
          </div>
          <span className="vs-scrollcue" aria-hidden="true">
            <i />
          </span>
        </section>

        <section ref={ref(1)} className="vs-sec vs-sec-problem">
          <div className="vs-col vs-col-right">
            <p className="vs-kicker" data-reveal="0">
              문제
            </p>
            <h2 data-reveal="1">
              선금을 보내고 나면
              <br />
              <em>돌려받을 길이 없었습니다.</em>
            </h2>
            <div className="vs-heard">
              {HEARD.map((_, i) => (
                <p
                  key={i}
                  ref={(el) => {
                    heardRefs.current[i] = el;
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        <section ref={ref(2)} className="vs-sec vs-sec-escrow">
          <div className="vs-col vs-col-center">
            <p className="vs-kicker" data-reveal="0">
              에스크로
            </p>
            <h2 className="vs-huge" data-reveal="1">
              전문가를 고르는 순간,
              <br />
              <em>대금은 가운데에 묶입니다.</em>
            </h2>
            <p data-reveal="2">의뢰인이 승인하기 전에는 누구도 꺼낼 수 없어요.</p>
          </div>
        </section>

        <section ref={ref(3)} className="vs-sec vs-sec-checks">
          <div className="vs-hpin">
            <p className="vs-kicker vs-hkicker">한 박씩 확인합니다</p>
            <div className="vs-htrack" ref={trackRef}>
              {CHECKS.map((c) => (
                <article key={c.no} className="vs-hpanel">
                  <span className="vs-hno">{c.no}</span>
                  <h3>{c.word}</h3>
                  <p>{c.text}</p>
                </article>
              ))}
              <div className="vs-hpanel vs-hpanel-end" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section ref={ref(4)} className="vs-sec vs-sec-approve">
          <div className="vs-col">
            <p className="vs-kicker" data-reveal="0">
              승인
            </p>
            <h2 data-reveal="1">
              마지막 박은
              <br />
              <em>의뢰인의 승인입니다.</em>
            </h2>
            <p data-reveal="2">결과를 보고 승인하면 정산되고, 문제가 있으면 이의제기로 멈춰요.</p>
          </div>
        </section>

        <section ref={ref(5)} className="vs-sec vs-sec-numbers">
          <div className="vs-numbers">
            {NUMBERS.map((n, i) => (
              <div key={n.label} className="vs-number" data-reveal={String(i)}>
                <strong>
                  <b
                    data-to={n.to}
                    ref={(el) => {
                      countRefs.current[i] = el;
                    }}
                  >
                    0
                  </b>
                  <small>{n.unit}</small>
                </strong>
                <span>{n.label}</span>
                <em>{n.note}</em>
              </div>
            ))}
          </div>
        </section>

        <section ref={ref(6)} className="vs-sec vs-sec-fields" aria-label="다루는 15개 전문 분야">
          <p className="vs-kicker vs-center" data-reveal="0">
            15개 전문 분야
          </p>
          {[0, 1].map((row) => (
            <div key={row} className={`vs-flow-row${row ? ' is-reverse' : ''}`} aria-hidden={row === 1}>
              <div>
                {[0, 1].map((k) => (
                  <span key={k}>
                    {(row ? Object.values(DOMAIN_LABELS).reverse() : Object.values(DOMAIN_LABELS)).map((d) => (
                      <em key={d}>{d}</em>
                    ))}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section ref={ref(7)} className="vs-sec vs-sec-final">
          <div className="vs-col vs-col-center">
            <h2 className="vs-huge" data-reveal="0">
              돈보다 먼저,
              <br />
              <em>사람을 확인했습니다.</em>
            </h2>
            {actions(true)}
          </div>
          <nav className="vs-landing-foot" aria-label="Vouchsafe 안내">
            <Link href="/community">커뮤니티</Link>
            <Link href="/map">지역 찾기</Link>
            <Link href="/matching">AI 매칭</Link>
            <span>결제는 PG 테스트 환경 · 실제 돈은 오가지 않아요</span>
          </nav>
        </section>
      </div>

      <div className="vs-landing-hud" aria-hidden="true">
        <p className="vs-landing-rhythm">
          장단 <span ref={rhythmRef}>진양조</span>
        </p>
        <div className="vs-landing-progress">
          {SECTIONS.map((sec, i) => (
            <i key={sec.id} className={activeSec >= i ? 'on' : ''} />
          ))}
        </div>
      </div>
      <button
        type="button"
        className="vs-landing-motion"
        aria-pressed={paused}
        aria-label={paused ? '움직임 재생' : '움직임 일시정지'}
        onClick={() => setPaused((v) => !v)}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d={paused ? 'M7 4l8 6-8 6z' : 'M7 5v10M13 5v10'} />
        </svg>
      </button>
    </div>
  );
}
