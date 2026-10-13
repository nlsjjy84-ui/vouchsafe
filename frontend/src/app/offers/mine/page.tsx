'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutList, MessageSquare, PackagePlus, PenSquare, ShoppingBag, Star } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { MyOffersResponse, OfferCard, platformFee, won } from '@/lib/offer-types';
import { FormErrorText } from '@/components/FormControls';
import { OfferGuide } from '@/components/OfferGuide';

/**
 * 내 상품 관리 (/offers/mine). 전문가가 올린 상품을 열린 것·마감한 것 모두 보여 주고,
 * 상품마다 문의·의뢰·후기 숫자와 내가 받는 돈을 함께 보여 준다. 고치기·마감·다시 열기를 여기서 한다.
 */
export default function MyOffersPage() {
  const { user, loading } = useAuth();
  const [data, setData] = useState<MyOffersResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<MyOffersResponse>('/offers/mine')
      .then((res) => setData(res.data))
      .catch((e) => setError(extractErrorMessage(e)));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function toggle(o: OfferCard) {
    setBusy(o.id);
    setError(null);
    try {
      await api.post(`/offers/${o.id}/${o.status === 'ACTIVE' ? 'close' : 'reopen'}`);
      load();
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return null;
  if (!user) {
    return (
      <p className="text-sm text-ink-500">
        <Link href="/login" className="font-semibold text-brand-sage">로그인</Link>한 뒤에 볼 수 있어요.
      </p>
    );
  }

  const s = data?.summary;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-tint-sage text-brand-sage">
            <LayoutList size={20} />
          </span>
          <div>
            <h1 className="font-display text-2xl tracking-wide text-ink-900">내 상품</h1>
            <p className="mt-1 text-sm text-ink-500">올린 상품의 문의·의뢰·후기를 한눈에 보고, 고치거나 마감할 수 있어요.</p>
          </div>
        </div>
        <Link href="/offers/new" className="inline-flex items-center gap-1.5 rounded-full bg-brand-sage px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
          <PackagePlus size={15} /> 상품 올리기
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="열린 상품" value={s ? `${s.active} / ${s.maxActive}` : '–'} />
        <Stat label="마감한 상품" value={s ? `${s.closed}` : '–'} />
        <Stat label="받은 문의" value={s ? `${s.questions}` : '–'} />
        <Stat label="들어온 의뢰" value={s ? `${s.orders}` : '–'} />
      </section>

      <div className="mt-4">
        <OfferGuide compact />
      </div>

      {error && <div className="mt-3"><FormErrorText>{error}</FormErrorText></div>}

      {data && data.items.length === 0 && (
        <div className="mt-5 rounded-4xl border border-dashed border-hairline-strong bg-surface-canvas p-10 text-center text-sm text-ink-500">
          아직 올린 상품이 없어요.
        </div>
      )}

      <ul className="mt-5 space-y-3">
        {data?.items.map((o) => (
          <li key={o.id} className={`rounded-3xl border border-hairline p-4 ${o.status === 'ACTIVE' ? 'bg-surface-canvas' : 'bg-surface-raised/60'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                {o.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.images[0]} alt="" className="h-16 w-16 flex-shrink-0 rounded-xl border border-hairline object-cover" />
                ) : (
                  <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-surface-raised text-[11px] text-ink-400">사진 없음</span>
                )}
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded-full bg-surface-raised px-2 py-0.5 text-ink-600">{o.domainLabel}</span>
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${o.status === 'ACTIVE' ? 'bg-tint-sage text-brand-sage' : 'bg-tint-red text-brand-red'}`}>
                      {o.status === 'ACTIVE' ? '판매 중' : '마감'}
                    </span>
                  </p>
                  <Link href={`/offers/${o.id}`} className="mt-1 block truncate text-base font-semibold text-ink-900 hover:underline">{o.title}</Link>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {won(o.price)} · 내가 받는 돈 <b className="text-brand-sage">{won(o.price - platformFee(o.price))}</b>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/offers/${o.id}/edit`} className="inline-flex items-center gap-1 rounded-full bg-surface-raised px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-hairline">
                  <PenSquare size={13} /> 고치기
                </Link>
                <button
                  type="button"
                  disabled={busy === o.id}
                  onClick={() => toggle(o)}
                  className="rounded-full bg-brand-ink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {o.status === 'ACTIVE' ? '마감하기' : '다시 열기'}
                </button>
              </div>
            </div>
            <p className="mt-3 flex flex-wrap gap-4 text-xs text-ink-500">
              <span className="inline-flex items-center gap-1"><MessageSquare size={13} /> 문의 {o.messageCount}</span>
              <span className="inline-flex items-center gap-1"><ShoppingBag size={13} /> 의뢰 {o.orderCount}</span>
              <span className="inline-flex items-center gap-1">
                <Star size={13} /> {o.rating ? `후기 ${o.rating.count}개 · 평균 ${o.rating.avg} / 10` : '후기 없음'}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-hairline bg-surface-canvas p-4">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums text-ink-900">{value}</p>
    </div>
  );
}
