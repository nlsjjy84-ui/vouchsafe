'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { DisputeSummary } from '@/lib/ai-types';
import { Button } from '@/components/Button';
import { AiBadge, AiNotice } from '@/components/AiBadge';

/** 관리자 분쟁 화면용 AI 요약. 쟁점 정리만 하고 판정은 하지 않는다(서버가 판정 표현을 걸러낸다). */
export function AiDisputeSummary({ disputeId }: { disputeId: string }) {
  const [data, setData] = useState<DisputeSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    try {
      const res = await api.post<DisputeSummary>(`/ai/disputes/${disputeId}/summary`);
      setData(res.data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-hairline bg-surface-raised p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button tone="navy" variant="soft" size="sm" disabled={busy} onClick={run}>
          <Sparkles size={13} className="mr-1 inline" />
          {busy ? '요약 중…' : data ? 'AI 요약 다시 만들기' : 'AI 쟁점 요약'}
        </Button>
        {data && <AiBadge meta={data.meta} />}
      </div>
      {error && <p className="mt-2 text-xs text-brand-red">{error}</p>}
      {data && (
        <div className="mt-3 space-y-3 text-sm text-ink-700">
          <p>{data.summary.summary}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold text-ink-500">의뢰인 쪽 주장</p>
              <ul className="list-disc space-y-1 pl-4">{data.summary.clientPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-ink-500">전문가 쪽 설명</p>
              <ul className="list-disc space-y-1 pl-4">{data.summary.expertPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-ink-500">관리자가 직접 확인할 점</p>
            <ul className="list-disc space-y-1 pl-4">{data.summary.checkpoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </div>
          <AiNotice meta={data.meta} />
        </div>
      )}
    </div>
  );
}
