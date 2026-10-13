'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Flag } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { timeAgo } from '@/lib/community-types';

interface OpenReport {
  id: string;
  reason: 'OFF_PLATFORM' | 'MISLEADING' | 'ABUSE' | 'OTHER';
  detail: string | null;
  createdAt: string;
  reporter: string;
  sameTargetReports: number;
  offer: { id: string; title: string; status: string };
  message: { id: string; content: string } | null;
}

const REASON_LABELS: Record<OpenReport['reason'], string> = {
  OFF_PLATFORM: '연락처·직거래 유도',
  MISLEADING: '사실과 다른 내용·자격',
  ABUSE: '욕설·도배',
  OTHER: '기타',
};

/**
 * [관리자] 상품·문의 신고 처리 (/admin/reports). 자동 규칙이 놓친 것을 사람이 판단하는 곳.
 * 문제없음 / 문의 가리기 / 상품 마감 중 하나로 처리하면 같은 대상의 신고가 함께 닫힌다.
 */
export default function AdminReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<OpenReport[] | null>(null);
  const [error, setError] = useState('');
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<OpenReport[]>('/offers/reports/open')
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

  async function resolve(id: string, action: 'DISMISS' | 'HIDE_MESSAGE' | 'CLOSE_OFFER') {
    setActing(id);
    setError('');
    try {
      await api.post(`/offers/reports/${id}/resolve`, { action });
      load();
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-tint-red text-brand-red">
          <Flag size={20} />
        </span>
        <div>
          <h1 className="font-display text-2xl tracking-wide text-ink-900">신고 처리</h1>
          <p className="mt-1 text-sm text-ink-500">상품·문의 신고 중 아직 처리하지 않은 것이에요. 처리하면 같은 대상의 신고가 함께 닫혀요.</p>
        </div>
      </div>
      {error && <p className="mb-3 text-sm text-brand-red">{error}</p>}
      {rows && rows.length === 0 && (
        <div className="rounded-4xl border border-dashed border-hairline-strong bg-surface-canvas p-10 text-center text-sm text-ink-500">처리할 신고가 없어요.</div>
      )}
      <ul className="space-y-3">
        {rows?.map((r) => (
          <li key={r.id} className="rounded-3xl border border-hairline bg-surface-canvas p-4">
            <p className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
              <span className="rounded-full bg-tint-red px-2 py-0.5 font-semibold text-brand-red">{REASON_LABELS[r.reason]}</span>
              <span>{r.message ? '문의 신고' : '상품 신고'}</span>
              {r.sameTargetReports > 1 && <b className="text-brand-red">같은 대상 신고 {r.sameTargetReports}건</b>}
              <span>신고자 {r.reporter} · {timeAgo(r.createdAt)}</span>
            </p>
            <Link href={`/offers/${r.offer.id}`} className="mt-2 block font-semibold text-ink-900 hover:underline">{r.offer.title}</Link>
            {r.message && <p className="mt-1 rounded-xl bg-surface-raised px-3 py-2 text-sm text-ink-700">{r.message.content}</p>}
            {r.detail && <p className="mt-1 text-sm text-ink-500">신고 내용: {r.detail}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={acting === r.id} onClick={() => resolve(r.id, 'DISMISS')} className="rounded-full bg-surface-raised px-3 py-1.5 text-xs font-semibold text-ink-700">
                문제없음
              </button>
              {r.message && (
                <button type="button" disabled={acting === r.id} onClick={() => resolve(r.id, 'HIDE_MESSAGE')} className="rounded-full bg-brand-ink px-3 py-1.5 text-xs font-semibold text-white">
                  문의 가리기
                </button>
              )}
              <button type="button" disabled={acting === r.id} onClick={() => resolve(r.id, 'CLOSE_OFFER')} className="rounded-full bg-brand-red px-3 py-1.5 text-xs font-semibold text-white">
                상품 마감
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
