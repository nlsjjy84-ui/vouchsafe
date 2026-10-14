'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { timeAgo } from '@/lib/community-types';

interface Pending {
  id: string;
  amount: number;
  account: string;
  holderName: string;
  requestedAt: string;
}

/**
 * [관리자] 정산금 출금 처리 (/admin/payouts). 처리 대기 신청을 오래된 것부터 보여 준다.
 * 승인하면 모의 이체 번호가 붙고(실제 이체 없음), 반려하면 사유가 전문가에게 보인다.
 * 두 관리자가 같은 신청을 동시에 눌러도 서버에서 한 번만 처리된다.
 */
export default function AdminPayoutsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Pending[] | null>(null);
  const [error, setError] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    api
      .get<Pending[]>('/payout-requests/pending')
      .then((res) => setRows(res.data))
      .catch((e) => setError(extractErrorMessage(e)));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'ADMIN') {
      router.replace('/offers');
      return;
    }
    load();
  }, [authLoading, user, router, load]);

  async function act(id: string, kind: 'approve' | 'reject') {
    setActing(id);
    setError('');
    try {
      await api.post(`/payout-requests/${id}/${kind}`, kind === 'reject' ? { reason } : {});
      setRejecting(null);
      setReason('');
      load();
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setActing(null);
    }
  }

  const total = rows?.reduce((s, r) => s + r.amount, 0) ?? 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-tint-red text-brand-red">
          <Banknote size={20} />
        </span>
        <div>
          <h1 className="font-display text-2xl tracking-wide text-ink-900">출금 처리</h1>
          <p className="mt-1 text-sm text-ink-500">
            전문가가 신청한 정산금 출금이에요. 승인하면 모의 이체 번호가 붙고, 실제 돈은 움직이지 않아요.
            {rows && rows.length > 0 && <b className="ml-1 tabular-nums text-ink-900">대기 {rows.length}건 · {total.toLocaleString('ko-KR')}원</b>}
          </p>
        </div>
      </div>
      {error && <p className="mb-3 text-sm text-brand-red">{error}</p>}
      {rows && rows.length === 0 && (
        <div className="rounded-4xl border border-dashed border-hairline-strong bg-surface-canvas p-10 text-center text-sm text-ink-500">처리할 출금 신청이 없어요.</div>
      )}
      <ul className="space-y-3">
        {rows?.map((r) => (
          <li key={r.id} className="rounded-3xl border border-hairline bg-surface-canvas p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-display text-xl tabular-nums text-ink-900">{r.amount.toLocaleString('ko-KR')}원</p>
              <p className="text-xs text-ink-500">{timeAgo(r.requestedAt)} 신청</p>
            </div>
            <p className="mt-1 text-sm text-ink-700">{r.account} · 예금주 {r.holderName}</p>
            {rejecting === r.id ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="반려 사유(2자 이상)" className="min-w-0 flex-1 rounded-2xl border border-hairline bg-surface-canvas px-3 py-1.5 text-sm" />
                <button type="button" disabled={acting === r.id || reason.trim().length < 2} onClick={() => act(r.id, 'reject')} className="rounded-full bg-brand-red px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
                  반려하기
                </button>
                <button type="button" onClick={() => { setRejecting(null); setReason(''); }} className="rounded-full bg-surface-raised px-3 py-1.5 text-xs font-semibold text-ink-700">
                  취소
                </button>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={acting === r.id} onClick={() => act(r.id, 'approve')} className="rounded-full bg-brand-ink px-3 py-1.5 text-xs font-semibold text-white">
                  승인(모의 송금)
                </button>
                <button type="button" disabled={acting === r.id} onClick={() => setRejecting(r.id)} className="rounded-full bg-surface-raised px-3 py-1.5 text-xs font-semibold text-ink-700">
                  반려
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
