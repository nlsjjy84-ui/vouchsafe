import Link from 'next/link';

/**
 * =========================================================================
 * 컨셉 (v2) — 실제 UI 크래프트로 유명한 사이트 8곳을 직접 열어보고 온 뒤 다시 짠
 * 랜딩 시안 (실제 라우트에 연결 안 함, 비교용).
 * =========================================================================
 * 참고한 것과 가져온 요소 (베낀 게 아니라 "이 사이트는 왜 남달라 보이는가"의
 * 답을 뽑아서 우리 맥락에 맞게 다시 만든 것):
 *
 *   - Cash App: 배경색을 "포인트"로만 쓰지 않고 히어로 전체를 채도 높은 브랜드
 *     색 하나로 풀블리드 처리 — 우리도 옅은 틴트 대신 진한 teal을 화면 전체에 깐다.
 *   - Raycast / Framer: 대각선 글로우 빔 / 스포트라이트 그라디언트로 어두운 배경에
 *     드라마를 줌 — conic/radial 그라디언트 레이어로 재현.
 *   - Arc (browser company): 섹션 경계를 직선 대신 스캘럽(부채꼴/파도) 모양으로 —
 *     우리 맥락에서는 장구/북의 가죽 테두리, 소리의 파동으로 재해석.
 *   - Ramp: 모노스페이스 라이브 티커 바(누적 거래/에스크로 금액 등) + 흩뿌려진
 *     듣기 좋은 숫자들.
 *   - Superhuman: 헤드라인 안에서 폰트 굵기를 "얇음 → 굵음"으로 섞어 강조 지점을
 *     만드는 방식.
 *   - Attio: 큰 배경 타이포 위에 실제 제품 화면(플로팅 윈도우)을 겹쳐서 레이어감을 줌.
 *   - Linear: 로고/태그 나열을 단조로운 그리드가 아니라 가로 스크롤 스트립으로.
 *   - Gumroad: 브랜드 마크를 작게 한 번만 쓰지 않고, 크기/회전을 다르게 흩뿌려서
 *     장식 요소 자체가 성격을 갖게 함 — JangdanMark를 여러 크기/회전으로 배치.
 * =========================================================================
 */

const TICKER_ITEMS = [
  '누적 거래 328건',
  '총 에스크로 보관액 1억 2,400만원',
  '활성 인증 전문가 15명',
  '15개 전문 분야',
  '처리중 분쟁 6건',
  '평균 정산 소요 2.3일',
];

const INDEX_ITEMS = [
  {
    n: '01',
    title: '전문가 자격 검증',
    desc: '국가 공인 자격증, 사업자 경력, 실무 경력 등 4가지 트랙으로 실력을 먼저 검증한 뒤에만 지원할 수 있어요.',
    tag: 'VERIFICATION',
  },
  {
    n: '02',
    title: '에스크로 안전거래',
    desc: '전문가가 선택되는 순간 대금이 에스크로에 잠기고, 결과물을 승인해야만 정산돼요.',
    tag: 'ESCROW',
  },
  {
    n: '03',
    title: '마일스톤 분할 정산',
    desc: '규모가 큰 프로젝트는 단계별로 나눠 부분 정산할 수 있어요.',
    tag: 'SETTLEMENT',
  },
];

const DOMAIN_STRIP = [
  '백엔드/DB 튜닝', 'Web3 보안 감사', 'IT 코드 리뷰', '크롤링 설계', '모바일 QA',
  '크리에이터 자문', '음원 마스터링', '인디게임 QA', '3D 최적화', '차량 진단',
  '건축물 하자진단', '소방 안전진단', '계약서 검토', '절세 팩트체크', '부동산 권리분석',
];

// 스캘럽(부채꼴) 경계 - 장구 가죽 테두리 / 소리의 파동을 그래픽으로 재해석.
function ScallopEdge({ flip = false, color = '#fafaf8' }: { flip?: boolean; color?: string }) {
  return (
    <svg
      viewBox="0 0 200 10"
      preserveAspectRatio="none"
      className={`block h-4 w-full sm:h-6 ${flip ? '-scale-y-100' : ''}`}
    >
      <defs>
        <pattern id={`scallop-${flip ? 'b' : 'a'}-${color.replace('#', '')}`} width="20" height="10" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="0" r="10" fill={color} />
        </pattern>
      </defs>
      <rect width="200" height="10" fill={`url(#scallop-${flip ? 'b' : 'a'}-${color.replace('#', '')})`} />
    </svg>
  );
}

export default function ConceptBPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fafaf8] font-sans text-[#111]">
      {/* 얇은 톱바 */}
      <header className="flex items-center justify-between border-b border-[#111]/10 px-6 py-4 sm:px-10">
        <span className="font-display text-lg tracking-wide">CREDOBOUNTY</span>
        <nav className="flex items-center gap-6 text-xs font-medium uppercase tracking-widest">
          <span>프로젝트</span>
          <span>인사이트</span>
          <span className="border border-[#111] px-3 py-1.5">로그인</span>
        </nav>
      </header>

      {/* 히어로 — teal 풀블리드 + 대각선 글로우 빔 + 흩뿌려진 JangdanMark 장식 */}
      <section
        className="relative overflow-hidden px-6 py-24 text-white sm:px-10 sm:py-32"
        style={{
          background:
            'radial-gradient(120% 90% at 15% 0%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 45%), ' +
            'conic-gradient(from 200deg at 80% -10%, rgba(255,255,255,0.28), rgba(255,255,255,0) 35%), ' +
            '#0d9488',
        }}
      >
        {/* 흩뿌린 브랜드 마크 장식 (Gumroad 참고 - 크기/회전을 다르게) */}
        <span className="pointer-events-none absolute right-10 top-10 rotate-12 opacity-30">
          <BarsMark size={64} />
        </span>
        <span className="pointer-events-none absolute right-32 top-40 -rotate-6 opacity-20">
          <BarsMark size={32} />
        </span>
        <span className="pointer-events-none absolute bottom-16 right-6 rotate-45 opacity-25">
          <BarsMark size={44} />
        </span>

        <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/70">
          검증된 전문가 에스크로 거래
        </p>
        {/* Superhuman식 - 한 헤드라인 안에서 굵기를 얇음→굵음으로 섞어 강조 지점을 만든다 */}
        <h1 className="mt-5 max-w-2xl text-5xl leading-[1.05] sm:text-6xl">
          <span className="font-light">자격을 검증받은</span>
          <br />
          <span className="font-black">전문가와의 거래.</span>
        </h1>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-white/80">
          신뢰가 중요한 고관여 전문 결과물을 의뢰하고, 에스크로로 안전하게
          대금을 주고받는 거래 플랫폼입니다.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/register"
            className="rounded-none bg-white px-7 py-3 text-sm font-semibold text-[#0d9488] transition-transform hover:-translate-y-0.5"
          >
            무료로 시작하기
          </Link>
          <Link
            href="/login"
            className="rounded-none border border-white/50 px-7 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            로그인
          </Link>
        </div>
      </section>
      <ScallopEdge color="#fafaf8" />

      {/* 라이브 티커 바 - Ramp 참고, 모노스페이스로 계속 흘러가는 숫자들 */}
      <div className="overflow-hidden border-b border-[#111]/10 bg-[#111] py-2.5">
        <div className="animate-[marquee-3_28s_linear_infinite] flex w-max gap-10 whitespace-nowrap font-mono text-[11px] uppercase tracking-widest text-white/70">
          {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
            <span key={i} className="flex items-center gap-10">
              {t}
              <span className="text-[#14b8a6]">●</span>
            </span>
          ))}
        </div>
      </div>

      {/* 핵심 가치 - 에디토리얼 인덱스 */}
      <section className="px-6 py-16 sm:px-10">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#666]">Why Vouchsafe</p>
        <div className="mt-6 divide-y divide-[#111] border-t border-[#111]">
          {INDEX_ITEMS.map((item) => (
            <div key={item.n} className="grid grid-cols-[auto,1fr] items-baseline gap-x-6 py-7 sm:grid-cols-[80px,1fr,1fr]">
              <span className="font-mono text-2xl text-[#14b8a6]">{item.n}</span>
              <h3 className="font-display text-xl tracking-wide sm:text-2xl">{item.title}</h3>
              <p className="col-span-2 mt-2 text-sm leading-relaxed text-[#444] sm:col-span-1 sm:mt-0">
                {item.desc}
                <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-[#14b8a6]">
                  {item.tag}
                </span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 플로팅 윈도우 레이어 - Attio 참고: 큰 배경 타이포 위에 실제 화면 카드를 겹친다 */}
      <section className="relative overflow-hidden border-y border-[#111]/10 bg-[#f1f1ee] px-6 py-24 sm:px-10">
        <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none font-display text-[22vw] leading-none text-[#111]/5">
          지원
        </span>
        <div className="relative mx-auto max-w-md rotate-[-1.5deg] rounded-none border border-[#111] bg-white shadow-[8px_8px_0_0_#111]">
          <div className="flex items-center gap-1.5 border-b border-[#111] px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#111]/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#111]/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#111]/20" />
            <span className="ml-2 font-mono text-[11px] text-[#666]">bounty #A02F</span>
          </div>
          <div className="p-5">
            <p className="font-mono text-[11px] text-[#999]">IT 개발 및 코드 리뷰</p>
            <h4 className="mt-1 font-display text-lg tracking-wide">레거시 결제 모듈 코드 리뷰</h4>
            <p className="mt-2 font-mono text-2xl">500,000<span className="text-sm">원</span></p>
            <div className="mt-4 flex items-center justify-between border-t border-[#111]/10 pt-4">
              <span className="font-mono text-[11px] text-[#999]">지원자 3명</span>
              <span className="rounded-none bg-[#111] px-3 py-1.5 text-[11px] font-semibold text-white">
                이 사람으로 결정
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 전문 분야 - Linear식 가로 스크롤 로고 스트립 */}
      <section className="overflow-hidden border-b border-[#111]/10 py-10">
        <p className="px-6 font-mono text-xs uppercase tracking-[0.3em] text-[#666] sm:px-10">15개 전문 분야</p>
        <div className="mt-5 animate-[marquee_35s_linear_infinite] flex w-max gap-8 whitespace-nowrap px-6 text-lg font-medium text-[#111]/70 sm:px-10">
          {[...DOMAIN_STRIP, ...DOMAIN_STRIP].map((d, i) => (
            <span key={i} className="flex items-center gap-8">
              {d}
              <span className="text-[#ccc]">/</span>
            </span>
          ))}
        </div>
      </section>

      {/* 하단 CTA - navy 풀블리드 + 스캘럽 상단 경계로 히어로와 짝을 맞춤 */}
      <ScallopEdge flip color="#0f172a" />
      <section className="bg-[#0f172a] px-6 py-20 text-white sm:px-10">
        <h2 className="max-w-lg text-4xl leading-[1.05] sm:text-5xl">
          <span className="font-light">지금</span> <span className="font-black">시작하세요.</span>
        </h2>
        <Link
          href="/register"
          className="mt-8 inline-block rounded-none bg-[#14b8a6] px-8 py-3 text-sm font-semibold text-[#0f172a] transition-transform hover:-translate-y-0.5"
        >
          무료 회원가입 →
        </Link>
      </section>
    </div>
  );
}

function BarsMark({ size }: { size: number }) {
  const barWidth = Math.max(3, Math.round(size / 6));
  const gap = Math.max(2, Math.round(size / 10));
  const heights = [0.35, 0.55, 0.8, 1];
  return (
    <span className="inline-flex items-end" style={{ height: size, gap }}>
      {heights.map((h, i) => (
        <span key={i} className="rounded-full bg-white" style={{ width: barWidth, height: Math.round(size * h) }} />
      ))}
    </span>
  );
}
