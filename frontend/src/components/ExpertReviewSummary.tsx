'use client';

import { useState } from 'react';
import { Quote, Sparkles } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { ReviewSummaryResponse } from '@/lib/ai-types';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/Button';
import { AiBadge, AiNotice } from '@/components/AiBadge';

/**
 * 전문가 프로필의 AI 후기 요약. 후기 원문을 대신하지 않고, 요약마다 근거가 된 후기 문장(인용)을 같이 보여준다.
 * 인용이 실제 후기에 없으면 서버가 그 항목을 버린다. 로그인한 사람만 누를 수 있다(AI 비용 때문).
 */
export function ExpertReviewSummary({ expertId }: { expertId: string }) {
  const { user } = useAuth();
  const [data, setData] = useState<ReviewSummaryResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    try {
      const res = await api.get<ReviewSummaryResponse>(`/ai/experts/${expertId}/review-summary`);
      setData(res.data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const s = data?.summary;
  return (
    <div className="mt-3 rounded-3xl border border-hairline bg-surface-raised p-4">
      <div className="flex flex-wrap items-center gap-2">
        {user ? (
          <Button tone="navy" variant="soft" size="sm" disabled={busy} onClick={run}>
            <Sparkles size={13} className="mr-1 inline" />
            {busy ? '요약 중…' : data ? 'AI 요약 다시 보기' : 'AI로 후기 요약 보기'}
          </Button>
        ) : (
          <p className="text-xs text-ink-500">로그인하면 AI가 후기를 요약해 드려요.</p>
        )}
        <AiBadge meta={data?.meta} />
      </div>
      {error && <p className="mt-2 text-xs text-brand-red">{error}</p>}
      {data && !data.enoughData && <p className="mt-3 text-sm text-ink-600">{data.message}</p>}
      {s && (
        <div className="mt-3 space-y-3 text-sm text-ink-700">
          <p>{s.summary}</p>
          {s.strengths.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-brand-sage">자주 칭찬받은 점</p>
              <ul className="space-y-2">
                {s.strengths.map((p, i) => (
                  <li key={i}>
                    <b className="text-ink-900">{p.point}</b>
                    <p className="mt-0.5 flex gap-1 text-xs text-ink-500"><Quote size={11} className="mt-0.5 flex-shrink-0" /> {p.quote}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {s.concerns.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-brand-red">아쉽다고 한 점</p>
              <ul className="space-y-2">
                {s.concerns.map((p, i) => (
                  <li key={i}>
                    <b className="text-ink-900">{p.point}</b>
                    <p className="mt-0.5 flex gap-1 text-xs text-ink-500"><Quote size={11} className="mt-0.5 flex-shrink-0" /> {p.quote}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-ink-400">글로 남긴 후기 {s.basedOn}건 기준 · 평균 {s.averageRating.toFixed(1)}점</p>
          <AiNotice meta={data?.meta} />
        </div>
      )}
    </div>
  );
}
