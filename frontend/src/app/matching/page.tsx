'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, UsersRound, Briefcase, Info, ArrowRight, Search } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Bounty, DOMAIN_LABELS, DomainType, MyDashboard } from '@/lib/types';
import { ExpertRecommendation, MatchResult } from '@/lib/ai-types';
import { AiBadge, AiNotice } from '@/components/AiBadge';
import { AiRecommendedBounties } from '@/components/AiRecommendedBounties';
import { Button } from '@/components/Button';
import { JangdanDivider } from '@/components/JangdanDivider';
import { FIELD_INPUT_CLASS } from '@/components/FormControls';

const EXPERT_FACTORS: { k: 'reputation' | 'certification' | 'topicFit' | 'experience'; label: string }[] = [
  { k: 'reputation', label: '평판' },
  { k: 'certification', label: '인증' },
  { k: 'topicFit', label: '주제 적합도' },
  { k: 'experience', label: '경력' },
];

/**
 * AI 매칭 (/matching) — 로그인한 사용자 역할에 맞춰
 *  - 의뢰인: 내 모집 중 프로젝트를 고르면 맞는 전문가를 추천
 *  - 전문가: 내 자격·완료 이력에 맞는 프로젝트를 추천
 * 점수 대부분은 서버가 계산하고, AI는 "주제가 얼마나 맞는지"만 채점한다. 최종 선택은 항상 사람이 한다.
 */
export default function MatchingPage() {
  const { user, loading } = useAuth();
  const isClient = user?.role === 'CLIENT' || user?.role === 'HYBRID';
  const isExpert = user?.role === 'EXPERT' || user?.role === 'HYBRID';
  const [tab, setTab] = useState<'client' | 'expert'>('client');

  useEffect(() => {
    if (user) setTab(user.role === 'EXPERT' ? 'expert' : 'client');
  }, [user]);

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-tint-clay text-brand-clay">
          <Sparkles size={20} />
        </span>
        <div>
          <h1 className="font-display text-2xl tracking-wide text-ink-900">AI 매칭</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-500">
            의뢰인에게는 프로젝트에 맞는 전문가를, 전문가에게는 내게 맞는 프로젝트를 점수와 근거로 추천해요.
          </p>
        </div>
      </div>

      <JangdanDivider />

      <div className="mt-5 flex gap-3 rounded-3xl border border-hairline bg-surface-canvas p-4 text-sm text-ink-600">
        <Info size={18} className="mt-0.5 flex-shrink-0 text-brand-clay" />
        <p>
          평판·인증·경력·최신성·경쟁 정도는 <b className="text-ink-800">서버가 실제 거래 기록으로 계산</b>하고, AI는 "과거 완료 프로젝트 제목과 이번 주제가 얼마나 맞는지"만 채점해요.
          AI에는 이름과 연락처가 전달되지 않고, 점수는 참고용이며 선택은 직접 해요.
        </p>
      </div>

      {loading && <div className="mt-6 h-40 animate-pulse rounded-4xl bg-surface-raised" />}

      {!loading && !user && (
        <div className="mt-6 rounded-4xl border border-dashed border-hairline-strong bg-surface-canvas p-10 text-center">
          <p className="text-sm text-ink-600">매칭 추천은 로그인 후에 받을 수 있어요.</p>
          <Link href="/login" className="mt-3 inline-block text-sm font-semibold text-brand-clay hover:underline">로그인하러 가기</Link>
        </div>
      )}

      {!loading && user && user.role === 'ADMIN' && (
        <p className="mt-6 text-sm text-ink-500">관리자 계정은 매칭 대상이 아니에요. 의뢰인 또는 전문가 계정으로 확인해 주세요.</p>
      )}

      {!loading && user && user.role !== 'ADMIN' && (
        <>
          {isClient && isExpert && (
            <div className="mt-6 flex gap-2">
              {([['client', '의뢰인으로 보기', UsersRound], ['expert', '전문가로 보기', Briefcase]] as const).map(([k, label, Icon]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                    tab === k ? 'bg-brand-ink text-white' : 'bg-surface-raised text-ink-700 hover:bg-hairline'
                  }`}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          )}

          {tab === 'client' && isClient && <ClientMatching />}
          {tab === 'expert' && isExpert && (
            <div className="mt-6">
              <AiRecommendedBounties />
              <Link href="/bounties" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-clay hover:underline">
                전체 프로젝트 둘러보기 <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const EXAMPLES: { text: string; domain: DomainType }[] = [
  { text: '다음 주에 중고 SUV를 사는데 같이 가서 사고 이력과 침수 여부를 봐 주실 분', domain: 'VEHICLE_DIAGNOSTICS' },
  { text: '빌라 전세 계약 전에 등기부 근저당과 선순위 보증금을 확인하고 싶어요', domain: 'REAL_ESTATE_TITLE_ANALYSIS' },
  { text: '경매로 나온 아파트를 대신 임장 가서 점유 상태를 확인해 주세요', domain: 'REAL_ESTATE_TITLE_ANALYSIS' },
  { text: '신축 아파트 입주 사전점검에 같이 가서 하자를 찾아 주세요', domain: 'BUILDING_DEFECT_INSPECTION' },
  { text: '윗집 누수로 천장에 곰팡이가 생겼는데 원인과 수리 범위를 알고 싶어요', domain: 'BUILDING_DEFECT_INSPECTION' },
  { text: '주문 목록 조회 쿼리가 3초 넘게 걸려요. 인덱스를 점검해 주세요', domain: 'BACKEND_DB_TUNING' },
  { text: '외주 개발 용역 계약서의 손해배상·저작권 조항이 불리하지 않은지 봐 주세요', domain: 'STARTUP_CONTRACT_REVIEW' },
  { text: '새 매장 오픈 전에 소화기와 감지기, 비상구가 기준에 맞는지 점검해 주세요', domain: 'FIRE_SAFETY_INSPECTION' },
];

type TextMatch = MatchResult<ExpertRecommendation> & { domainType: DomainType; guessed: boolean };

function ClientMatching() {
  const [bounties, setBounties] = useState<Bounty[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, MatchResult<ExpertRecommendation>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const [text, setText] = useState('');
  const [domain, setDomain] = useState<DomainType | ''>('');
  const [textBusy, setTextBusy] = useState(false);
  const [textError, setTextError] = useState('');
  const [textResult, setTextResult] = useState<TextMatch | null>(null);

  useEffect(() => {
    api
      .get<MyDashboard>('/dashboard/me')
      .then((res) => {
        const open = res.data.clientBounties.filter((b) => b.status === 'PENDING');
        setBounties(open);
        if (open.length) setSelected(open[0].id);
      })
      .catch(() => setBounties([]));
  }, []);

  async function run() {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.get<MatchResult<ExpertRecommendation>>(`/ai/bounties/${selected}/expert-recommendations`);
      setResult((prev) => ({ ...prev, [selected]: res.data }));
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function runText() {
    setTextBusy(true);
    setTextError('');
    try {
      const res = await api.post<TextMatch>('/ai/expert-recommendations/by-text', { text, ...(domain ? { domainType: domain } : {}) });
      setTextResult(res.data);
    } catch (e) {
      setTextError(extractErrorMessage(e));
    } finally {
      setTextBusy(false);
    }
  }

  const data = selected ? result[selected] : undefined;
  const q = query.trim().toLowerCase();
  const shown = (bounties ?? []).filter(
    (b) => !q || b.title.toLowerCase().includes(q) || (DOMAIN_LABELS[b.domainType as DomainType] ?? '').toLowerCase().includes(q),
  );

  return (
    <>
      <section className="mt-6 rounded-4xl border border-hairline bg-surface-raised p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
          <Search size={16} /> 맡기고 싶은 일을 적어서 찾기
        </h2>
        <p className="mt-1 text-xs text-ink-500">프로젝트를 등록하지 않아도 돼요. 분야를 비워 두면 적은 내용으로 분야를 골라요. 적은 내용은 저장되지 않아요.</p>
        <textarea
          className={`${FIELD_INPUT_CLASS} mt-3 h-24`}
          value={text}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          placeholder="예) 다음 주에 중고 SUV를 사는데 같이 가서 사고 이력과 침수 여부를 봐 주실 분"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.text}
              type="button"
              onClick={() => { setText(ex.text); setDomain(''); }}
              className="rounded-full border border-hairline bg-surface-canvas px-3 py-1 text-[11px] text-ink-600 hover:border-brand-clay/50 hover:text-brand-clay"
            >
              {ex.text.length > 26 ? `${ex.text.slice(0, 26)}…` : ex.text}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select className={`${FIELD_INPUT_CLASS} w-auto min-w-0`} value={domain} onChange={(e) => setDomain(e.target.value as DomainType | '')}>
            <option value="">분야 자동으로 고르기</option>
            {(Object.entries(DOMAIN_LABELS) as [DomainType, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <Button tone="teal" variant="solid" size="sm" disabled={textBusy || text.trim().length < 8} onClick={runText}>
            {textBusy ? '찾는 중…' : '전문가 추천받기'}
          </Button>
          {textResult?.meta && <AiBadge meta={textResult.meta} />}
        </div>
        {textError && <p className="mt-3 rounded-xl bg-tint-red px-3 py-2 text-sm text-brand-red">{textError}</p>}
        {textResult && (
          <p className="mt-3 text-xs text-ink-600">
            분야: <b className="text-ink-800">{DOMAIN_LABELS[textResult.domainType]}</b>
            {textResult.guessed ? ' (적은 내용으로 고름 — 다르면 위에서 분야를 직접 골라 주세요)' : ''}
          </p>
        )}
        {textResult && <Recommendations data={textResult} />}
      </section>

      <section className="mt-6 rounded-4xl border border-hairline bg-surface-raised p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
          <UsersRound size={16} /> 내 모집 중 프로젝트로 찾기
        </h2>
        {bounties === null && <div className="mt-3 h-24 animate-pulse rounded-2xl bg-surface-canvas" />}
        {bounties && bounties.length === 0 && (
          <p className="mt-3 text-sm text-ink-500">
            모집 중인 내 프로젝트가 없어요.{' '}
            <Link href="/bounties/new" className="font-semibold text-brand-clay hover:underline">프로젝트 등록하기</Link>
          </p>
        )}
        {bounties && bounties.length > 0 && (
          <>
            {bounties.length > 4 && (
              <input
                className={`${FIELD_INPUT_CLASS} mt-3`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`프로젝트 ${bounties.length}개 중에서 제목이나 분야로 검색`}
              />
            )}
            <ul className="mt-3 grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {shown.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(b.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                      selected === b.id ? 'border-brand-clay bg-tint-clay/50' : 'border-hairline bg-surface-canvas hover:border-brand-clay/40'
                    }`}
                  >
                    <p className="line-clamp-1 text-sm font-semibold text-ink-900">{b.title}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {DOMAIN_LABELS[b.domainType as DomainType] ?? b.domainType} · {Number(b.bountyAmount).toLocaleString('ko-KR')}원
                    </p>
                  </button>
                </li>
              ))}
              {shown.length === 0 && <li className="text-sm text-ink-500">검색 결과가 없어요.</li>}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button tone="teal" variant="solid" size="sm" disabled={busy || !selected} onClick={run}>
                {busy ? '찾는 중…' : '전문가 추천받기'}
              </Button>
              {selected && (
                <Link href={`/bounties/${selected}`} className="text-xs font-semibold text-ink-500 hover:text-brand-clay">
                  프로젝트 상세 보기
                </Link>
              )}
              {data?.meta && <AiBadge meta={data.meta} />}
            </div>
          </>
        )}
        {error && <p className="mt-3 rounded-xl bg-tint-red px-3 py-2 text-sm text-brand-red">{error}</p>}
        {data && <Recommendations data={data} />}
      </section>
      <p className="mt-3 text-[11px] text-ink-400">이 분야에서 승인된 자격이 있는 전문가만 후보가 돼요. 이름 대신 후보 A/B 라벨과 완료 프로젝트 제목만 AI에 전달돼요.</p>
    </>
  );
}

function Recommendations({ data }: { data: MatchResult<ExpertRecommendation> }) {
  return (
    <>
      {data.note && <p className="mt-3 text-sm text-ink-600">{data.note}</p>}
      {data.recommendations.length > 0 && (
        <ul className="mt-4 space-y-3">
          {data.recommendations.map((r, idx) => (
            <li key={r.expertId} className="rounded-2xl border border-hairline bg-surface-canvas p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-ink-900">
                  {idx + 1}위 ·{' '}
                  <Link href={`/experts/${r.expertId}`} className="hover:text-brand-clay hover:underline">{r.expertName ?? '전문가'}</Link>
                  {r.alreadyApplied && (
                    <span className="ml-2 rounded-full bg-tint-sage px-2 py-0.5 text-[11px] font-semibold text-brand-sage">이미 지원함</span>
                  )}
                </p>
                <p className="whitespace-nowrap font-display text-xl text-ink-900">
                  {r.totalScore}<span className="text-xs text-ink-400"> / 100</span>
                </p>
              </div>
              <p className="mt-0.5 text-xs text-ink-500">이 분야 완료 {r.completedInDomain}건</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-hairline">
                <div className="h-full rounded-full bg-brand-clay" style={{ width: `${Math.min(100, r.totalScore)}%` }} />
              </div>
              <dl className="mt-3 grid gap-1 text-xs text-ink-600 sm:grid-cols-2">
                {EXPERT_FACTORS.map(({ k, label }) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt>{label}</dt>
                    <dd className="text-right">{r.breakdown[k].points}/{r.breakdown[k].max} <span className="text-ink-400">({r.breakdown[k].note})</span></dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
      {data.meta && <AiNotice meta={data.meta} />}
    </>
  );
}
