'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Bounty, DOMAIN_LABELS } from '@/lib/types';
import { BountyStatusBadge } from '@/components/StatusBadge';

interface BountyPage {
  items: Bounty[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const PAGE_SIZE = 10;

/** 바운티(일감) 목록 화면. 로그인만 하면 누구나 볼 수 있다. */
export default function BountiesPage() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<BountyPage>('/bounties', { params: { page, limit: PAGE_SIZE } })
      .then((res) => {
        setBounties(res.data.items);
        setTotalPages(res.data.totalPages);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">바운티 둘러보기</h1>
        <Link
          href="/bounties/new"
          className="rounded bg-brand-teal px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          + 바운티 등록
        </Link>
      </div>

      {loading && <p className="text-sm text-slate-500">불러오는 중...</p>}
      {!loading && bounties.length === 0 && (
        <p className="text-sm text-slate-500">아직 등록된 바운티가 없어요.</p>
      )}

      <ul className="space-y-3">
        {bounties.map((b) => (
          <li key={b.id}>
            <Link
              href={`/bounties/${b.id}`}
              className="block rounded border border-slate-200 bg-white p-5 hover:border-brand-teal"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">
                  {DOMAIN_LABELS[b.domainType]}
                </span>
                <BountyStatusBadge status={b.status} />
              </div>
              <h2 className="text-lg font-medium">{b.title}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{b.description}</p>
              <p className="mt-2 font-semibold text-brand-navy">
                {b.bountyAmount.toLocaleString()}원
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {!loading && total > 0 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-sm text-slate-500">
            {page} / {totalPages} 페이지 (전체 {total}건)
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
