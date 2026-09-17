'use client';

import { useEffect, useState } from 'react';
import {
  Sparkles,
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BadgeCheck,
  PiggyBank,
  Target,
  Flame,
  CalendarRange,
  Pencil,
} from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { MyInsightsResponse } from '@/lib/types';
import { jangdanDelay } from '@/lib/motion';

/**
 * =========================================================================
 * AI 인사이트 페이지 — 기획서 부제 주제 구현 화면.
 *   1) AI 기반 개인화 예산 및 소비패턴 분석
 *   2) AI & 마이데이터 기반 개인화 금융관리
 * =========================================================================
 * GET /ai-insights/me 하나로 요약 통계 + 분야별 지출/수입 분포 + 6개월 추이 +
 * 자연어 인사이트 문장을 모두 받아와 이 화면에 그린다 (백엔드: AiInsightsService,
 * 지금은 규칙 기반 Mock으로 문장을 만들고, 나중에 실제 LLM 호출로 교체 가능하게
 * 설계되어 있음 - 백엔드 코드 주석 참고).
 *
 * 아래 3개 섹션(예산 목표, 소비 이상탐지, 다음 달 예측)은
 * "AI 해석" 또는 "마이데이터 연결" 둘 중 하나에 반드시 해당하는 것만 추가했다 -
 * 두 주제의 본질에서 벗어나는 기능(알림센터 등)은 이 페이지에 넣지 않는다.
 * (검토 과정에서 "인증-수익 연결 추천" 아이디어는 이 기준에 억지로 끼워맞춘
 * 것에 가깝다고 판단해 제외했다)
 * =========================================================================
 */
export default function InsightsPage() {
  const [data, setData] = useState<MyInsightsResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    return api
      .get('/ai-insights/me')
      .then((res) => setData(res.data))
      .catch((err) => setError(extractErrorMessage(err)));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded-xl bg-surface-raised" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-4xl bg-surface-raised" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-4xl bg-surface-raised" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-4xl border border-dashed border-hairline-strong bg-surface-canvas p-10 text-center text-sm text-ink-500">
        {error || '데이터를 불러오지 못했어요.'}
      </div>
    );
  }

  const maxDomainAmount = Math.max(
    1,
    ...data.spendingByDomain.map((d) => d.amount),
    ...data.earningByDomain.map((d) => d.amount),
  );
  const maxTrend = Math.max(1, ...data.monthlyTrend.flatMap((m) => [m.spent, m.earned]));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles size={20} className="text-brand-teal" />
        <h1 className="font-display text-2xl tracking-wide text-ink-900">AI 인사이트</h1>
        <span className="rounded-full bg-tint-teal px-2 py-0.5 text-[11px] font-semibold text-brand-teal">
          내 활동 데이터 기반 자동 분석
        </span>
      </div>

      <div className="flex divide-x divide-hairline overflow-x-auto rounded-4xl border border-hairline bg-surface-canvas">
        <SummaryCard
          index={0}
          icon={Wallet}
          label="총 지출"
          value={formatWon(data.summary.totalSpent)}
          tone="blue"
        />
        <SummaryCard
          index={1}
          icon={PiggyBank}
          label="총 수익"
          value={formatWon(data.summary.totalEarned)}
          tone="teal"
        />
        <SummaryCard
          index={2}
          icon={BadgeCheck}
          label="승인된 자격 인증"
          value={`${data.summary.approvedCertificationCount}건`}
          tone="amber"
        />
        <SummaryCard
          index={3}
          icon={AlertTriangle}
          label="이의제기중"
          value={`${data.summary.disputedCount}건`}
          tone="red"
        />
      </div>

      {/* 기능1: 예산 목표 대비 소비 (주제1 - 예산/소비패턴 분석) */}
      <BudgetCard budget={data.budget} onSaved={load} />

      {/* 기능2: 소비 이상탐지 하이라이트 (주제1) */}
      {data.spendingAnomaly && (
        <div className="flex items-start gap-3 rounded-4xl border border-brand-amber/30 bg-tint-amber p-5">
          <Flame size={20} className="mt-0.5 flex-shrink-0 text-brand-amber" />
          <div>
            <p className="text-sm font-semibold text-ink-900">
              '{data.spendingAnomaly.domainLabel}' 지출이 급증했어요
            </p>
            <p className="mt-1 text-sm text-ink-700">
              이번 달 {formatWon(data.spendingAnomaly.thisMonthAmount)} — 최근 3개월 평균{' '}
              {formatWon(data.spendingAnomaly.avgPrevAmount)} 대비{' '}
              <span className="font-semibold text-brand-amber">+{data.spendingAnomaly.increasePct}%</span>
            </p>
          </div>
        </div>
      )}

      <div className="rounded-4xl border border-hairline bg-surface-canvas p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
          <Sparkles size={16} className="text-brand-teal" /> AI가 발견한 인사이트
        </h2>
        <ul className="space-y-2">
          {data.insights.map((line, i) => (
            <li
              key={i}
              style={jangdanDelay(i)}
              className="animate-stagger-in rounded-xl bg-tint-teal px-4 py-3 text-sm leading-relaxed text-ink-700"
            >
              {line}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DomainBreakdownCard
          title="분야별 지출 분포"
          icon={TrendingDown}
          items={data.spendingByDomain}
          max={maxDomainAmount}
          barClass="bg-brand-blue"
        />
        <DomainBreakdownCard
          title="분야별 수익 분포"
          icon={TrendingUp}
          items={data.earningByDomain}
          max={maxDomainAmount}
          barClass="bg-brand-teal"
        />
      </div>

      <div className="rounded-4xl border border-hairline bg-surface-canvas p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink-900">최근 6개월 지출/수익 추이</h2>
        <div className="flex items-end gap-4">
          {data.monthlyTrend.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-32 items-end gap-1">
                <div
                  className="w-3 rounded-t bg-brand-blue"
                  style={{ height: `${Math.max(2, (m.spent / maxTrend) * 100)}%` }}
                  title={`지출 ${formatWon(m.spent)}`}
                />
                <div
                  className="w-3 rounded-t bg-brand-teal"
                  style={{ height: `${Math.max(2, (m.earned / maxTrend) * 100)}%` }}
                  title={`수익 ${formatWon(m.earned)}`}
                />
              </div>
              <span className="text-[11px] text-ink-400">{m.month.slice(5)}월</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-ink-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-blue" /> 지출
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-teal" /> 수익
          </span>
        </div>

        {/* 기능3: 다음 달 지출/수익 예측 (주제1+2) */}
        {data.forecast && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-hairline-strong border-dashed p-4">
            <CalendarRange size={18} className="flex-shrink-0 text-ink-400" />
            <p className="text-sm text-ink-700">
              최근 추세로 보면 다음 달엔 약{' '}
              <span className="font-semibold text-brand-blue">{formatWon(data.forecast.nextMonthSpent)}</span> 지출,
              약 <span className="font-semibold text-brand-teal">{formatWon(data.forecast.nextMonthEarned)}</span>{' '}
              수익이 예상돼요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** 기능1: 예산 목표 카드 - 설정 전엔 입력을 유도하고, 설정 후엔 진행률 바를 보여준다. */
function BudgetCard({ budget, onSaved }: { budget: MyInsightsResponse['budget']; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(budget.goal ? String(budget.goal) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const goal = value.trim() ? Number(value) : null;
      await api.patch('/users/me/budget', { monthlyBudgetGoal: goal });
      await onSaved();
      setEditing(false);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className="flex flex-wrap items-center gap-3 rounded-4xl border border-hairline bg-surface-canvas p-5"
      >
        <Target size={18} className="flex-shrink-0 text-brand-teal" />
        <label className="text-sm font-medium text-ink-700">이번 달 예산 목표</label>
        <input
          type="number"
          min={10000}
          step={10000}
          placeholder="예: 500000 (비우면 해제)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-48 rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-blue px-4 py-2 text-xs font-semibold text-white transition-colors hover:brightness-90 disabled:opacity-50"
        >
          {saving ? '저장중...' : '저장'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-ink-500 hover:border-hairline-strong"
        >
          취소
        </button>
        {error && <p className="w-full text-xs text-brand-red">{error}</p>}
      </form>
    );
  }

  if (!budget.goal) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex w-full items-center gap-3 rounded-4xl border border-dashed border-hairline-strong bg-surface-canvas p-5 text-left transition-colors hover:border-brand-teal"
      >
        <Target size={18} className="flex-shrink-0 text-ink-400" />
        <span className="text-sm text-ink-500">
          아직 월 예산 목표가 없어요. 목표를 설정하면 AI가 지출 속도를 보고 알려드려요.
        </span>
        <span className="ml-auto flex-shrink-0 text-xs font-semibold text-brand-teal">설정하기 →</span>
      </button>
    );
  }

  const rate = budget.usageRate ?? 0;
  const barClass = rate >= 100 ? 'bg-brand-red' : rate >= 80 ? 'bg-brand-amber' : 'bg-brand-teal';

  return (
    <div className="rounded-4xl border border-hairline bg-surface-canvas p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <Target size={16} className="text-brand-teal" /> 이번 달 예산 진행률
        </h2>
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1 text-xs text-ink-400 hover:text-brand-teal"
        >
          <Pencil size={12} /> 수정
        </button>
      </div>
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="text-ink-700">
          {formatWon(budget.thisMonthSpent)} / {formatWon(budget.goal)}
        </span>
        <span className={`font-semibold ${rate >= 100 ? 'text-brand-red' : 'text-ink-900'}`}>{rate}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-raised">
        <div
          className={`h-full rounded-full ${barClass} transition-all duration-700 ease-out`}
          style={{ width: `${Math.min(100, Math.max(2, rate))}%` }}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  index,
  icon: Icon,
  label,
  value,
  tone,
}: {
  index: number;
  icon: typeof Wallet;
  label: string;
  value: string;
  tone: 'blue' | 'teal' | 'amber' | 'red';
}) {
  const toneClass = {
    blue: 'bg-tint-blue text-brand-blue',
    teal: 'bg-tint-teal text-brand-teal',
    amber: 'bg-tint-amber text-brand-amber',
    red: 'bg-tint-red text-brand-red',
  }[tone];

  return (
    <div style={jangdanDelay(index)} className="animate-stagger-in min-w-[130px] flex-1 p-4">
      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${toneClass}`}>
        <Icon size={16} strokeWidth={1.75} />
      </div>
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className="mt-0.5 truncate font-display text-lg tracking-wide text-ink-900">{value}</p>
    </div>
  );
}

function DomainBreakdownCard({
  title,
  icon: Icon,
  items,
  max,
  barClass,
}: {
  title: string;
  icon: typeof TrendingUp;
  items: MyInsightsResponse['spendingByDomain'];
  max: number;
  barClass: string;
}) {
  return (
    <div className="rounded-4xl border border-hairline bg-surface-canvas p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
        <Icon size={16} /> {title}
      </h2>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-400">아직 데이터가 없어요.</p>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 6).map((item, i) => (
            <div key={item.domainType} style={jangdanDelay(i)} className="animate-stagger-in">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="truncate text-ink-700">{item.domainLabel}</span>
                <span className="flex-shrink-0 font-medium text-ink-900">
                  {item.percentage}% · {formatWon(item.amount)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-raised">
                <div
                  className={`h-full rounded-full ${barClass} transition-all duration-700 ease-out`}
                  style={{ width: `${Math.max(3, (item.amount / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}
