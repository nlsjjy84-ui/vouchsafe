import Link from 'next/link';

/**
 * =========================================================================
 * 컨셉 (v3) — concept-b(teal/네이비 + 각진 스캘럽)에 대한 피드백:
 * "색도 그렇고 폰트도 네모네모하고... 반복되는 습관을 깨라"에 대한 답.
 *
 * concept-b와 의도적으로 다르게 간 지점들:
 *   - 색: teal 단일톤 반복 대신, 클레이(황토)/잉크(먹)/세이지(쑥) 3색을
 *     섹션마다 다르게 주역으로 세움 - "브랜드 컬러 하나를 계속 우려먹지 않기".
 *   - 형태: rounded-none(각진 사각형)을 걷어내고, 원형/블롭(비정형 곡선)을
 *     기본 형태 언어로 삼음 - 버튼은 완전한 원(pill), 카드는 큰 라운드,
 *     장식은 손으로 그린 듯한 블롭 SVG.
 *   - 글꼴: Do Hyeon(고딕 디스플레이) 대신 이번엔 Gowun Batang(세리프)을
 *     감성 헤드라인에 써서 - 매번 같은 폰트 조합을 쓰는 습관 자체를 깼다.
 *   - 사물놀이 모티프도 다르게: concept-b는 "장구 가죽 테두리(스캘럽)"였다면
 *     여기는 "징/북소리가 퍼지는 동심원 파동"을 형태 언어로 씀 - 각진 파형이
 *     아니라 둥글게 퍼지는 원.
 * =========================================================================
 */

const STATS = [
  { n: '328', label: '누적 거래' },
  { n: '15', label: '인증 전문가' },
  { n: '2.3일', label: '평균 정산' },
  { n: '15', label: '전문 분야' },
];

const FEATURES = [
  {
    tag: '01 · 검증',
    title: '자격을 먼저 확인해요',
    desc: '국가 공인 자격증, 사업자 경력, 실무 경력 — 4가지 트랙 중 하나로 실력을 증명한 전문가만 지원할 수 있어요.',
    tone: 'clay',
  },
  {
    tag: '02 · 보관',
    title: '대금은 잠겨있어요',
    desc: '전문가가 선택되는 순간 대금이 에스크로에 들어가고, 결과물을 승인하기 전까지는 누구도 손댈 수 없어요.',
    tone: 'ink',
  },
  {
    tag: '03 · 정산',
    title: '단계별로 나눠 받아요',
    desc: '규모가 큰 프로젝트는 마일스톤으로 쪼개서, 끝날 때까지 기다리지 않고 단계마다 정산받을 수 있어요.',
    tone: 'sage',
  },
];

const DOMAINS = [
  '백엔드/DB 튜닝', 'Web3 보안 감사', 'IT 코드 리뷰', '크롤링 설계', '모바일 QA',
  '크리에이터 자문', '음원 마스터링', '인디게임 QA', '3D 최적화', '차량 진단',
  '건축물 하자진단', '소방 안전진단', '계약서 검토', '절세 팩트체크', '부동산 권리분석',
];

const TONE_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  clay: { bg: 'bg-[#c2410c]', text: 'text-[#c2410c]', ring: 'ring-[#c2410c]/25' },
  ink: { bg: 'bg-[#241a14]', text: 'text-[#241a14]', ring: 'ring-[#241a14]/15' },
  sage: { bg: 'bg-[#5b6b4f]', text: 'text-[#5b6b4f]', ring: 'ring-[#5b6b4f]/25' },
};

// 징/북소리가 퍼지는 동심원 파동 - concept-b의 각진 스캘럽과 대비되는 둥근 형태 언어.
function RippleRings({ className = '', color = '#c2410c' }: { className?: string; color?: string }) {
  const radii = [40, 80, 120, 160];
  return (
    <svg viewBox="0 0 340 340" className={className} fill="none">
      {radii.map((r) => (
        <circle key={r} cx="170" cy="170" r={r} stroke={color} strokeWidth="1.5" opacity={1 - r / 220} />
      ))}
    </svg>
  );
}

// 손으로 그린 듯한 비정형 블롭 - 사각형(rounded-none) 습관을 완전히 벗어난 형태.
function Blob({ className = '', color = '#f4c98b' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className}>
      <path
        fill={color}
        d="M45.2,-58.3C58.4,-49.6,68.9,-33.9,72.1,-16.6C75.3,0.7,71.2,19.6,60.8,34.5C50.4,49.4,33.7,60.3,15.4,65.8C-2.9,71.3,-22.8,71.4,-38.9,63.1C-55,54.8,-67.3,38.1,-71.8,19.6C-76.3,1.1,-73,-19.2,-62.6,-34.8C-52.2,-50.4,-34.7,-61.3,-16.2,-66.8C2.3,-72.3,32,-67,45.2,-58.3Z"
        transform="translate(100 100)"
      />
    </svg>
  );
}

export default function ConceptCPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f1e8] font-sans text-[#241a14]">
      {/* 톱바 - 원형 로고칩 + pill 버튼, 각진 요소 없음 */}
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#241a14] font-serifAccent text-sm text-[#f7f1e8]">
            credo
          </span>
          <span className="font-serifAccent text-lg">CredoBounty</span>
        </span>
        <nav className="flex items-center gap-3 text-sm">
          <span className="hidden sm:inline text-[#241a14]/70">바운티</span>
          <span className="hidden sm:inline text-[#241a14]/70">인사이트</span>
          <span className="rounded-full bg-[#241a14] px-5 py-2 text-xs font-medium text-[#f7f1e8]">로그인</span>
        </nav>
      </header>

      {/* 히어로 - 비대칭 2단 구성: 세리프 헤드라인(좌) + 동심원+블롭 목업(우) */}
      <section className="relative px-6 pb-20 pt-10 sm:px-10">
        <div className="grid gap-12 sm:grid-cols-[1.1fr,0.9fr] sm:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#c2410c]/10 px-4 py-1.5 text-xs font-medium text-[#c2410c]">
              ● 검증된 전문가 에스크로 거래
            </span>
            <h1 className="mt-6 font-serifAccent text-[2.75rem] leading-[1.2] sm:text-6xl">
              자격을 <span className="text-[#c2410c]">검증받은</span>
              <br />
              전문가와의 거래
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[#241a14]/70">
              신뢰가 중요한 고관여 전문 결과물을 의뢰하고, 에스크로로 안전하게
              대금을 주고받는 거래 플랫폼입니다.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/register"
                className="rounded-full bg-[#241a14] px-7 py-3.5 text-sm font-semibold text-[#f7f1e8] transition-transform hover:-translate-y-0.5"
              >
                무료로 시작하기
              </Link>
              <Link href="/login" className="text-sm font-medium text-[#241a14]/70 underline-offset-4 hover:underline">
                로그인 →
              </Link>
            </div>
          </div>

          <div className="relative flex items-center justify-center py-6">
            <Blob className="absolute h-64 w-64 opacity-70 sm:h-80 sm:w-80" color="#f4c98b" />
            <RippleRings className="absolute h-72 w-72 sm:h-96 sm:w-96" color="#c2410c" />
            {/* 떠 있는 바운티 카드 - 둥근 모서리 + 부드러운 그림자 (concept-b의 하드섀도 각진 카드와 대비) */}
            <div className="relative w-64 rotate-[2deg] rounded-[28px] bg-white p-5 shadow-[0_20px_45px_-15px_rgba(36,26,20,0.35)]">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5b6b4f]/15 text-[#5b6b4f]">✓</span>
                <div>
                  <p className="text-[11px] text-[#241a14]/50">IT 개발 및 코드 리뷰</p>
                  <p className="text-sm font-semibold">레거시 결제 모듈 코드 리뷰</p>
                </div>
              </div>
              <p className="mt-4 font-serifAccent text-2xl text-[#c2410c]">500,000원</p>
              <div className="mt-4 flex items-center justify-between border-t border-[#241a14]/10 pt-3 text-xs text-[#241a14]/50">
                <span>지원자 3명</span>
                <span className="rounded-full bg-[#241a14] px-3 py-1.5 text-[11px] font-medium text-white">결정하기</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 통계 - 원형 배지 클러스터 (concept-b의 모노스페이스 티커 바와 대비) */}
      <section className="border-y border-[#241a14]/10 bg-[#241a14] px-6 py-14 sm:px-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full border border-[#f7f1e8]/20 font-serifAccent text-xl text-[#f7f1e8] sm:h-24 sm:w-24 sm:text-2xl">
                {s.n}
              </span>
              <span className="text-xs text-[#f7f1e8]/60">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 핵심 가치 - 3색 로테이션 카드 (clay/ink/sage) - 한 색만 우려먹지 않기 */}
      <section className="px-6 py-20 sm:px-10">
        <p className="font-serifAccent text-2xl text-center">왜 CredoBounty일까요</p>
        <div className="mx-auto mt-10 grid max-w-5xl gap-6 sm:grid-cols-3">
          {FEATURES.map((f) => {
            const tone = TONE_STYLES[f.tone];
            return (
              <div key={f.tag} className={`rounded-[28px] bg-white p-7 ring-1 ${tone.ring}`}>
                <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-semibold text-white ${tone.bg}`}>
                  {f.tag}
                </span>
                <h3 className="mt-4 font-serifAccent text-xl">{f.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#241a14]/65">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 전문 분야 - 흩어진 pill 클라우드 (concept-b의 직선 마퀴 스트립과 대비) */}
      <section className="relative overflow-hidden bg-[#f4c98b]/25 px-6 py-20 sm:px-10">
        <RippleRings className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 opacity-40" color="#5b6b4f" />
        <p className="font-serifAccent text-2xl">15개 전문 분야</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {DOMAINS.map((d, i) => (
            <span
              key={d}
              className={`rounded-full px-4 py-2 text-sm ${
                i % 3 === 0
                  ? 'bg-[#c2410c] text-white'
                  : i % 3 === 1
                    ? 'bg-[#241a14] text-white'
                    : 'bg-white text-[#241a14] ring-1 ring-[#241a14]/10'
              }`}
            >
              {d}
            </span>
          ))}
        </div>
      </section>

      {/* 하단 CTA - 잉크 배경 + 세리프 헤드라인 + 클레이 pill 버튼 */}
      <section className="relative overflow-hidden bg-[#241a14] px-6 py-24 text-center text-[#f7f1e8] sm:px-10">
        <RippleRings className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 opacity-20" color="#f7f1e8" />
        <p className="relative font-serifAccent text-4xl sm:text-5xl">지금 시작하세요</p>
        <p className="relative mx-auto mt-4 max-w-sm text-sm text-[#f7f1e8]/60">
          검증된 전문가와의 첫 거래, 에스크로로 안전하게 시작해보세요.
        </p>
        <Link
          href="/register"
          className="relative mt-8 inline-block rounded-full bg-[#c2410c] px-9 py-3.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
        >
          무료 회원가입 →
        </Link>
      </section>
    </div>
  );
}
