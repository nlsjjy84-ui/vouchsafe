'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Lock, Layers, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DOMAIN_LABELS, DomainType } from '@/lib/types';
import { JangdanMark } from '@/components/JangdanMark';
import { JangdanDivider } from '@/components/JangdanDivider';
import { jangdanDelay } from '@/lib/motion';

// 이용 흐름 섹션의 4단계 - 커넥티드 스테퍼로 그리기 위해 배열로 뽑아뒀다.
const STEPS = [
  { step: 1, title: '바운티 등록', description: '의뢰인이 원하는 전문 분야와 예산을 정해 일감을 등록해요.' },
  { step: 2, title: '전문가 지원', description: '자격이 검증된 전문가만 지원할 수 있어요.' },
  { step: 3, title: '선택 및 진행', description: '의뢰인이 전문가를 선택하면 대금이 에스크로에 잠겨요.' },
  { step: 4, title: '검수 및 정산', description: '결과물을 확인하고 승인하면 자동으로 정산돼요.' },
];

// 기획서 2장 도메인 카테고리 분류 (backend common/enums/domain-type.enum.ts와 동일).
// 프론트/백엔드가 값만 복제하는 기존 방식(types.ts 상단 주석 참고)을 그대로 따른다.
const DOMAIN_CATEGORY: Record<DomainType, 'A' | 'B' | 'C'> = {
  BACKEND_DB_TUNING: 'A',
  WEB3_SECURITY_AUDIT: 'A',
  DEV_CODE_REVIEW: 'A',
  CRAWLING_ARCHITECTURE: 'A',
  MOBILE_QA_AUTOMATION: 'A',
  TECH_CREATOR_CONSULTING: 'B',
  AUDIO_MASTERING_REVIEW: 'B',
  INDIE_GAME_QA: 'B',
  GRAPHICS_3D_OPTIMIZATION: 'B',
  VEHICLE_DIAGNOSTICS: 'B',
  BUILDING_DEFECT_INSPECTION: 'B',
  FIRE_SAFETY_INSPECTION: 'B',
  STARTUP_CONTRACT_REVIEW: 'C',
  TAX_STRUCTURE_FACTCHECK: 'C',
  REAL_ESTATE_TITLE_ANALYSIS: 'C',
};

/**
 * 서비스 소개(랜딩) 화면.
 *
 * 이전에는 '/'로 들어오면 서버 사이드에서 무조건 /bounties로 리다이렉트했다 - 그런데
 * BountiesController는 로그인 없이는 목록 조회 자체가 막혀있어서(JwtAuthGuard),
 * 로그아웃 상태로 처음 들어온 방문자는 "이 서비스가 뭘 하는지" 설명은 하나도 못 보고
 * 텅 빈 바운티 목록만 보게 되는 문제가 있었다. 이제는 클라이언트에서 로그인 여부를
 * 확인해서, 로그인한 사용자만 /bounties로 자동 이동시키고 로그아웃 상태에서는
 * 서비스 소개 화면을 보여준다.
 *
 * UI 리뉴얼(v2)에서: 히어로에 JangdanMark(장단 리듬 브랜드 마크)를 크게 두어 첫
 * 인상에 "우리만의 시각적 시그니처"가 있다는 걸 바로 보여주고, 카드들은 장단
 * 리듬(간격이 점점 좁아지는 스태거)으로 순서대로 나타나게 했다.
 */
export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/bounties');
    }
  }, [loading, user, router]);

  if (loading || user) {
    return null;
  }

  return (
    <div className="space-y-14">
      {/* 히어로 - 단색 navy 대신 navy→navyLight 그라디언트로 깊이감을 주고,
          헤드라인은 font-display(Do Hyeon)로 "여기가 브랜드의 얼굴"이라는 신호를 준다. */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-ink via-brand-ink to-brand-inkLight px-8 py-16 text-white sm:px-14">
        <div className="pointer-events-none absolute -right-6 -top-6 opacity-90 sm:right-10 sm:top-10">
          <JangdanMark size={96} animated variant="dark" />
        </div>
        <p className="text-sm font-medium uppercase tracking-wider text-brand-clay">
          검증된 전문가 에스크로 거래 플랫폼
        </p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl leading-tight tracking-wide sm:text-5xl">
          자격을 검증받은 전문가와,
          <br />
          {/* 세리프 악센트(고운바탕체) 활성화 - 전체가 font-display(두꺼운 로고체)이면
              오히려 "강조점 없이 다 똑같이 세다"가 된다. 문장의 정서적 핵심 어구
              ("안전하게 정산되는")만 결이 다른 서체로 얹어서 진짜 강조를 만든다. */}
          <span className="font-serifAccent font-normal">안전하게 정산되는</span> 거래.
        </h1>
        <p className="mt-4 max-w-xl text-white/70">
          CredoBounty는 백엔드 튜닝부터 건축물 하자진단, 계약서 검토까지 — 신뢰가 중요한
          고관여 전문 결과물을 의뢰하고, 에스크로로 안전하게 대금을 주고받는 거래
          플랫폼입니다.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/register"
            className="rounded-full bg-brand-clay px-7 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-clayDeep hover:shadow-lg"
          >
            무료로 시작하기
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/30 px-7 py-3 text-sm font-medium text-white transition-colors hover:border-white hover:bg-white hover:text-brand-ink"
          >
            로그인
          </Link>
        </div>
      </section>

      {/* 핵심 가치 3가지 */}
      <section>
        <h2 className="text-xl font-bold text-ink-900">왜 CredoBounty인가요</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <FeatureCard
            index={0}
            icon={ShieldCheck}
            accent="teal"
            title="전문가 자격 검증"
            description="국가 공인 자격증, 사업자 경력, 실무 경력 등 4가지 트랙으로 전문가의 실력을 먼저 검증한 뒤에만 바운티에 지원할 수 있어요."
          />
          <FeatureCard
            index={1}
            icon={Lock}
            accent="blue"
            title="에스크로 안전거래"
            description="전문가가 선택되는 순간 대금이 에스크로에 잠기고, 결과물을 승인해야만 정산돼요. 돈 떼일 걱정 없이 거래할 수 있어요."
          />
          <FeatureCard
            index={2}
            icon={Layers}
            accent="amber"
            title="마일스톤 분할 정산"
            description="규모가 큰 프로젝트는 단계별로 나눠 부분 정산할 수 있어서, 한 번에 큰 금액이 오가는 부담을 줄일 수 있어요."
          />
        </div>
      </section>

      <JangdanDivider />

      {/* AI 인사이트 강조 */}
      <section className="rounded-2xl bg-tint-clay p-6 sm:p-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-clay text-white">
              <Sparkles size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink-900">AI가 내 거래 패턴을 분석해드려요</h2>
              <p className="mt-1 max-w-xl text-sm text-ink-700">
                가입 후에는 내 지출/수익을 분야별·월별로 자동 분석하고, 맞춤 인사이트 문장까지
                받아볼 수 있어요. 챗봇에게 바로 물어봐도 좋아요.
              </p>
            </div>
          </div>
          <Link
            href="/register"
            className="whitespace-nowrap rounded-full bg-brand-clay px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-clayDeep hover:shadow-md"
          >
            가입하고 체험하기
          </Link>
        </div>
      </section>

      {/* 이용 흐름 - 똑같이 생긴 박스 4개를 나열하던 방식 대신, 원형 스텝 번호를
          가로선으로 이어 "흐름(flow)"이라는 레이아웃 그 자체가 보이게 했다. */}
      <section>
        <h2 className="text-xl font-bold text-ink-900">이용 흐름</h2>

        <div className="relative mt-10 hidden sm:block">
          <div className="absolute left-6 right-6 top-6 h-0.5 bg-hairline-strong" />
          <div className="relative flex justify-between">
            {STEPS.map((s, i) => (
              <div key={s.step} style={jangdanDelay(i)} className="animate-stagger-in flex w-40 flex-col items-center text-center">
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-ink font-display text-lg tracking-wide text-white">
                  {s.step}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-ink-900">{s.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-500">{s.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-4 sm:hidden">
          {STEPS.map((s, i) => (
            <div key={s.step} style={jangdanDelay(i)} className="animate-stagger-in flex gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-ink font-display text-sm tracking-wide text-white">
                {s.step}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-ink-900">{s.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-500">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 전문 분야 */}
      <section>
        <h2 className="text-xl font-bold text-ink-900">15개 전문 분야를 다룹니다</h2>
        <p className="mt-1 text-sm text-ink-500">
          온라인/디지털 진단부터 오프라인 현장 진단, 법률·세무 자문까지 폭넓게 지원해요.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <DomainCategoryCard index={0} category="A" label="온라인/디지털 기술 진단" />
          <DomainCategoryCard index={1} category="B" label="오프라인/현장 진단" />
          <DomainCategoryCard index={2} category="C" label="전문 자문/자격사 영역" />
        </div>
      </section>

      {/* 하단 CTA - 히어로와 짝을 이루는 navy 판넬로 마무리해서, 전체 페이지가
          light → light → dark(히어로) → light → ... → dark(CTA)로 교차되게 했다. */}
      <section className="overflow-hidden rounded-2xl bg-brand-ink p-8 text-center text-white sm:p-12">
        <h2 className="font-display text-2xl tracking-wide">지금 바로 시작해보세요</h2>
        <p className="mt-2 text-sm text-white/70">
          의뢰인으로 일감을 등록하거나, 전문가로 지원해보세요.
        </p>
        <Link
          href="/register"
          className="mt-6 inline-block rounded-full bg-brand-clay px-7 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-clayDeep hover:shadow-lg"
        >
          무료 회원가입
        </Link>
      </section>
    </div>
  );
}

// 흰 배경 + 테두리 카드를 3개 반복하던 기존 방식 대신, 각 카드를 해당 강조색의
// 옅은 틴트로 통째로 채워서(solid tint) "카드 3개가 다 똑같이 생겼다"는 인상을 깨고
// 색으로 먼저 구분되게 했다. 아이콘 배지도 반대로 진한 색을 채워 반전 대비를 준다.
const ACCENT_STYLES: Record<'teal' | 'blue' | 'amber', { panel: string; badge: string; text: string }> = {
  teal: { panel: 'bg-tint-clay', badge: 'bg-brand-clay text-white', text: 'text-brand-clay' },
  blue: { panel: 'bg-tint-sage', badge: 'bg-brand-sage text-white', text: 'text-brand-sage' },
  amber: { panel: 'bg-tint-gold', badge: 'bg-brand-gold text-white', text: 'text-brand-gold' },
};

function FeatureCard({
  index,
  icon: Icon,
  accent,
  title,
  description,
}: {
  index: number;
  icon: typeof ShieldCheck;
  accent: 'teal' | 'blue' | 'amber';
  title: string;
  description: string;
}) {
  const style = ACCENT_STYLES[accent];
  return (
    <div style={jangdanDelay(index)} className={`animate-stagger-in rounded-2xl p-5 ${style.panel}`}>
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${style.badge}`}>
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <h3 className="mt-3 font-semibold text-ink-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{description}</p>
    </div>
  );
}

const CATEGORY_STYLES: Record<'A' | 'B' | 'C', { panel: string; badge: string }> = {
  A: { panel: 'bg-tint-clay', badge: 'bg-brand-clay text-white' },
  B: { panel: 'bg-tint-gold', badge: 'bg-brand-gold text-white' },
  C: { panel: 'bg-tint-sage', badge: 'bg-brand-sage text-white' },
};

function DomainCategoryCard({
  index,
  category,
  label,
}: {
  index: number;
  category: 'A' | 'B' | 'C';
  label: string;
}) {
  const domains = (Object.keys(DOMAIN_CATEGORY) as Array<keyof typeof DOMAIN_CATEGORY>).filter(
    (d) => DOMAIN_CATEGORY[d] === category,
  );
  const style = CATEGORY_STYLES[category];
  return (
    <div style={jangdanDelay(index)} className={`animate-stagger-in rounded-2xl p-5 ${style.panel}`}>
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}>
        Category {category}
      </span>
      <h3 className="mt-2 font-semibold text-ink-900">{label}</h3>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {domains.slice(0, 4).map((d) => (
          <span
            key={d}
            className="rounded-full bg-surface-canvas/70 px-2.5 py-1 text-xs text-ink-700"
          >
            {DOMAIN_LABELS[d]}
          </span>
        ))}
        {domains.length > 4 && (
          <span className="rounded-full bg-surface-canvas/70 px-2.5 py-1 text-xs text-ink-400">
            +{domains.length - 4}
          </span>
        )}
      </div>
    </div>
  );
}
