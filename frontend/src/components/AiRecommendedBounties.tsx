'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { BountyRecommendation, MatchResult } from '@/lib/ai-types';
import { DOMAIN_LABELS, DomainType } from '@/lib/types';
import { Button } from '@/components/Button';
import { AiBadge, AiNotice } from '@/components/AiBadge';

/** 전문가 전용: 내 자격 분야와 완료 이력에 맞는 프로젝트 추천. 지원은 전문가가 직접 한다. */
export function AiRecommendedBounties() {
  const [data, setData] = useState<MatchResult<BountyRecommendation> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setBusy(true);
    setError('');
    try {
      setData((await api.get<MatchResult<BountyRecommendation>>('/ai/recommended-bounties')).data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 rounded-4xl border border-hairline bg-surface-raised p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
          <Sparkles size={16} /> 나에게 맞는 프로젝트
        </h2>
        <Button tone="teal" variant="soft" size="sm" disabled={busy} onClick={load}>
          {busy ? '찾는 중…' : 'AI 추천받기'}
        </Button>
        {data?.meta && <AiBadge meta={data.meta} />}
      </div>
      {error && <p className="mt-3 rounded-xl bg-tint-red px-3 py-2 text-sm text-brand-red">{error}</p>}
      {data?.note && <p className="mt-3 text-sm text-ink-600">{data.note}</p>}
      {data && data.recommendations.length > 0 && (
        <ul className="mt-3 space-y-3">
          {data.recommendations.map((r, idx) => (
            <li key={r.bountyId} className="rounded-xl border border-hairline bg-surface-canvas p-3">
              <div className="flex items-baseline justify-between gap-3">
                <Link href={`/bounties/${r.bountyId}`} className="text-sm font-semibold text-ink-900 hover:text-brand-clay">
                  {idx + 1}위 · {r.title}
                </Link>
                <p className="whitespace-nowrap font-display text-lg text-ink-900">{r.totalScore}<span className="text-xs text-ink-400"> / 100</span></p>
              </div>
              <p className="mt-1 text-xs text-ink-500">
                {DOMAIN_LABELS[r.domainType as DomainType] ?? r.domainType} · {r.amount.toLocaleString('ko-KR')}원 · 지원자 {r.applicantCount}명
              </p>
              <dl className="mt-2 grid gap-1 text-xs text-ink-600 sm:grid-cols-2">
                {(['domain', 'topicFit', 'freshness', 'competition'] as const).map((k) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt>{{ domain: '분야', topicFit: '주제 적합도', freshness: '최신성', competition: '경쟁 정도' }[k]}</dt>
                    <dd className="text-right">{r.breakdown[k].points}/{r.breakdown[k].max} <span className="text-ink-400">({r.breakdown[k].note})</span></dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-ink-400">승인된 자격이 있는 분야의 모집 중 프로젝트만 추천합니다. 점수는 참고용이고 지원 여부는 직접 정합니다. AI에는 내 이름 없이 완료한 프로젝트 제목만 전달됩니다.</p>
      {data?.meta && <AiNotice meta={data.meta} />}
    </section>
  );
}
