'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, PenSquare, Eye, Heart, MessageSquare, Image as ImageIcon, MessagesSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { DOMAIN_LABELS, DomainType } from '@/lib/types';
import { CATEGORY_LABELS, PostCategory, PostListResponse, timeAgo } from '@/lib/community-types';
import { AuthorChip, CategoryBadge } from '@/components/CommunityBits';
import { JangdanDivider } from '@/components/JangdanDivider';
import { jangdanDelay } from '@/lib/motion';

const TABS: { key: 'ALL' | PostCategory; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'REVIEW', label: CATEGORY_LABELS.REVIEW },
  { key: 'QUESTION', label: CATEGORY_LABELS.QUESTION },
  { key: 'WARNING', label: CATEGORY_LABELS.WARNING },
  { key: 'TIP', label: CATEGORY_LABELS.TIP },
  { key: 'NOTICE', label: CATEGORY_LABELS.NOTICE },
];

const DOMAIN_OPTIONS = Object.entries(DOMAIN_LABELS) as [DomainType, string][];

/**
 * 커뮤니티 게시판 (/community) — 로그인 없이 읽을 수 있다. 글쓰기·댓글·좋아요만 로그인 필요.
 * 익명 기능이 없고, 작성자 이름과 전문가 인증 분야가 항상 보인다.
 */
export default function CommunityPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState<'ALL' | PostCategory>('ALL');
  const [domain, setDomain] = useState<string>('');
  const [sort, setSort] = useState<'latest' | 'popular'>('latest');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PostListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    api
      .get<PostListResponse>('/community/posts', {
        params: { category: category === 'ALL' ? undefined : category, domain: domain || undefined, q: query || undefined, sort, page },
      })
      .then((res) => setData(res.data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [category, domain, query, sort, page]);

  useEffect(() => {
    load();
  }, [load]);

  function pick<T>(setter: (v: T) => void, v: T) {
    setter(v);
    setPage(1);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-tint-clay text-brand-clay">
            <MessagesSquare size={20} />
          </span>
          <div>
            <h1 className="font-display text-2xl tracking-wide text-ink-900">커뮤니티</h1>
            <p className="mt-1 max-w-xl text-sm text-ink-500">
              거래 후기, 질문, 사기 주의 사례를 나눠요. 익명 없이 이름과 전문가 인증 분야가 함께 보여서 글을 믿고 참고할 수 있어요.
            </p>
          </div>
        </div>
        {user ? (
          <Link
            href="/community/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-clay px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            <PenSquare size={15} /> 글쓰기
          </Link>
        ) : (
          <Link href="/login" className="text-sm font-medium text-brand-clay hover:underline">
            로그인하고 글쓰기
          </Link>
        )}
      </div>

      <JangdanDivider />

      <div className="mt-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => pick(setCategory, t.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              category === t.key ? 'bg-brand-ink text-white' : 'bg-surface-raised text-ink-700 hover:bg-hairline'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(q.trim());
        }}
      >
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="제목·내용 검색"
            className="w-full rounded-xl border border-hairline bg-surface px-3 py-2 pl-9 text-sm outline-none focus:border-brand-clay focus:ring-2 focus:ring-brand-clay/20"
          />
        </div>
        <select
          value={domain}
          onChange={(e) => pick(setDomain, e.target.value)}
          className="rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-ink-700 outline-none focus:border-brand-clay"
        >
          <option value="">모든 분야</option>
          {DOMAIN_OPTIONS.map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => pick(setSort, e.target.value as 'latest' | 'popular')}
          className="rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-ink-700 outline-none focus:border-brand-clay"
        >
          <option value="latest">최신순</option>
          <option value="popular">조회순</option>
        </select>
        <button type="submit" className="rounded-xl bg-surface-raised px-3.5 py-2 text-sm font-semibold text-ink-700 hover:bg-hairline">
          검색
        </button>
      </form>

      {loading && (
        <div className="mt-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-3xl bg-surface-raised" />
          ))}
        </div>
      )}

      {!loading && failed && (
        <p className="mt-6 text-sm text-brand-red">게시글을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
      )}

      {!loading && !failed && data && data.items.length === 0 && (
        <div className="mt-5 flex flex-col items-center gap-2 rounded-4xl border border-dashed border-hairline-strong bg-surface-canvas py-16 text-center">
          <MessagesSquare size={28} className="text-ink-400" />
          <p className="text-sm text-ink-500">조건에 맞는 글이 아직 없어요.</p>
        </div>
      )}

      {!loading && data && data.items.length > 0 && (
        <>
          <p className="mt-4 text-xs text-ink-400">총 {data.total}개</p>
          <ul className="mt-2 space-y-3">
            {data.items.map((p, i) => (
              <li key={p.id} style={jangdanDelay(i)} className="animate-stagger-in">
                <Link
                  href={`/community/${p.id}`}
                  className={`flex gap-4 rounded-3xl border border-hairline p-4 shadow-sm transition-colors hover:border-brand-clay/50 ${
                    p.category === 'NOTICE' ? 'bg-tint-ink/40' : 'bg-surface-canvas'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoryBadge category={p.category} />
                      {p.domainType && (
                        <span className="rounded-full bg-surface-raised px-2.5 py-1 text-[11px] font-medium text-ink-600">
                          {DOMAIN_LABELS[p.domainType]}
                        </span>
                      )}
                    </div>
                    <h2 className="mt-2 line-clamp-1 text-base font-semibold text-ink-900">{p.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-500">{p.excerpt}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      <AuthorChip author={p.author} size={22} />
                      <span className="text-xs text-ink-400">{timeAgo(p.createdAt)}</span>
                      <span className="inline-flex items-center gap-3 text-xs text-ink-400">
                        <span className="inline-flex items-center gap-1"><Eye size={13} /> {p.viewCount}</span>
                        <span className="inline-flex items-center gap-1"><Heart size={13} /> {p.likeCount}</span>
                        <span className="inline-flex items-center gap-1"><MessageSquare size={13} /> {p.commentCount}</span>
                        {p.imageCount > 0 && <span className="inline-flex items-center gap-1"><ImageIcon size={13} /> {p.imageCount}</span>}
                      </span>
                    </div>
                  </div>
                  {p.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbnail} alt="" className="hidden h-24 w-24 flex-shrink-0 rounded-2xl border border-hairline object-cover sm:block" />
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {data.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-full bg-surface-raised px-3.5 py-1.5 font-semibold text-ink-700 disabled:opacity-40"
              >
                이전
              </button>
              <span className="text-ink-500">{data.page} / {data.totalPages}</span>
              <button
                type="button"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-full bg-surface-raised px-3.5 py-1.5 font-semibold text-ink-700 disabled:opacity-40"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
