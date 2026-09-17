'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gavel, ShieldAlert } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AdminDispute, DOMAIN_LABELS } from '@/lib/types';
import { jangdanDelay } from '@/lib/motion';
import { GhostPillButton } from '@/components/FormControls';

/**
 * 관리자 전용 "분쟁 중재" 화면 (기획서 9장 관리자 1차 중재).
 * GET /disputes/open으로 아직 처리되지 않은 분쟁만 모아 보여주고,
 * 각 건에 대해 "의뢰인 환불" 또는 "전문가 정산 유지"로 즉시 중재할 수 있다.
 */
export default function AdminDisputesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'ADMIN') {
      router.replace('/bounties');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  function load() {
    setLoading(true);
    api
      .get('/disputes/open')
      .then((res) => setDisputes(res.data))
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  async function resolve(id: string, refund: boolean) {
    const adminNote = window.prompt(
      refund ? '환불 처리 사유를 입력해주세요' : '정산 유지 처리 사유를 입력해주세요',
    );
    if (adminNote === null) return;
    setActingId(id);
    try {
      await api.post(`/disputes/${id}/resolve`, { adminNote, refund });
      setDisputes((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      window.alert(extractErrorMessage(err));
    } finally {
      setActingId(null);
    }
  }

  if (authLoading || (user && user.role !== 'ADMIN')) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Gavel size={20} className="text-brand-red" />
        <h1 className="font-display text-2xl tracking-wide text-ink-900">분쟁 중재</h1>
        <span className="rounded-full bg-tint-red px-2 py-0.5 text-[11px] font-semibold text-brand-red">
          처리 대기 {disputes.length}건
        </span>
      </div>

      {loading && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-4xl bg-surface-raised" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-4xl border border-dashed border-hairline-strong p-8 text-center text-sm text-ink-500">
          {error}
        </div>
      )}

      {!loading && !error && disputes.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-4xl border border-dashed border-hairline-strong p-10 text-center">
          <ShieldAlert size={28} className="text-ink-400" />
          <p className="text-sm text-ink-500">지금은 처리 대기중인 분쟁이 없어요.</p>
        </div>
      )}

      <div className="divide-y divide-hairline overflow-hidden rounded-4xl border border-hairline bg-surface-canvas">
        {disputes.map((d, i) => (
          <div key={d.id} style={jangdanDelay(i)} className="animate-stagger-in p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  {d.bounty?.title ?? `바운티 #${d.bountyId.slice(0, 8)}`}
                </p>
                {d.bounty && (
                  <p className="text-xs text-ink-500">
                    {DOMAIN_LABELS[d.bounty.domainType]} · {d.bounty.bountyAmount.toLocaleString('ko-KR')}원
                  </p>
                )}
              </div>
              <span className="text-[11px] text-ink-400">
                접수일 {new Date(d.createdAt).toLocaleDateString('ko-KR')}
              </span>
            </div>
            <p className="mb-4 rounded-xl bg-tint-red px-4 py-3 text-sm text-ink-700">{d.reason}</p>
            <div className="flex gap-2">
              <GhostPillButton tone="red" disabled={actingId === d.id} onClick={() => resolve(d.id, true)}>
                의뢰인 환불로 종결
              </GhostPillButton>
              <GhostPillButton tone="teal" disabled={actingId === d.id} onClick={() => resolve(d.id, false)}>
                전문가 정산 유지로 종결
              </GhostPillButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
