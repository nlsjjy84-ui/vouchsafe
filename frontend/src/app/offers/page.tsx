'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Clock, LayoutList, MapPin, MessageSquare, PackagePlus, ShoppingBag, ShieldCheck, Star, Store } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { DOMAIN_LABELS, DomainType } from '@/lib/types';
import { FEE_RULE_TEXT, OfferListResponse, manwon, won } from '@/lib/offer-types';
import { JangdanDivider } from '@/components/JangdanDivider';
import { jangdanDelay } from '@/lib/motion';

const DOMAIN_OPTIONS = Object.entries(DOMAIN_LABELS) as [DomainType, string][];

/**
 * 검증된 전문가 상품 (/offers). 자격 심사를 통과한 전문가가 "이 일을 이 가격에" 먼저 올리고,
 * 의뢰인은 그 가격 그대로 의뢰한다. 커뮤니티와 따로 둬서 상품 글이 게시판을 덮지 않는다.
 * 첫 화면은 글보다 숫자 — 검증된 전문가 수, 심사 통과율, 상품 수와 가운데 가격부터 보여 준다.
 */
export default function OffersPage() {
  const { user } = useAuth();
  const [domain, setDomain] = useState('');
  const [sort, setSort] = useState<'latest' | 'popular' | 'cheap'>('latest');
  const [data, setData] = useState<OfferListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    api
      .get<OfferListResponse>('/offers', { params: { domain: domain || undefined, sort } })
      .then((res) => setData(res.data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [domain, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const s = data?.stats;
  const t = data?.trust;
  const licensed = t?.byTrack.find((b) => b.track === 'STANDARD')?.experts ?? 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-tint-sage text-brand-sage">
            <Store size={20} />
          </span>
          <div>
            <h1 className="font-display text-2xl tracking-wide text-ink-900">검증된 전문가 상품</h1>
            <p className="mt-1 max-w-xl text-sm text-ink-500">
              자격 심사를 통과한 전문가만 상품을 올릴 수 있어요. 가격은 전문가가 정하고, 의뢰인은 그 가격 그대로 맡기면 돼요.
              돈은 결과를 승인할 때 전문가에게 넘어가요.
            </p>
          </div>
        </div>
        {user ? (
          <div className="flex flex-wrap gap-2">
          <Link
            href="/offers/mine"
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-hairline"
          >
            <LayoutList size={15} /> 내 상품
          </Link>
          <Link
            href="/offers/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-sage px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            <PackagePlus size={15} /> 상품 올리기
          </Link>
          </div>
        ) : (
          <Link href="/login" className="text-sm font-medium text-brand-sage hover:underline">
            로그인하고 상품 올리기
          </Link>
        )}
      </div>

      {/* 숫자 먼저: 검증된 전문가라는 근거 → 시장 규모 */}
      <section aria-label="검증된 전문가 숫자" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          icon={<BadgeCheck size={16} />}
          label="검증된 전문가"
          value={t ? `${t.verifiedExperts}명` : '–'}
          note={t ? (licensed === t.verifiedExperts ? '전원 국가 공인 자격증으로 인증' : `국가 공인 자격증 ${licensed}명 · 서류 반려 ${t.rejected}건`) : ''}
          strong
        />
        <Tile
          icon={<ShieldCheck size={16} />}
          label="정산까지 끝난 거래"
          value={t ? `${t.settledDeals}건` : '–'}
          note={t ? `환불된 거래 ${t.refundedDeals}건도 거래 사례에 그대로 공개` : ''}
        />
        <Tile icon={<ShoppingBag size={16} />} label="올라온 상품" value={s ? `${s.activeOffers}개` : '–'} note={s ? `전문가 ${s.experts}명이 올림` : ''} />
        <Tile icon={<MessageSquare size={16} />} label="가운데 가격" value={s?.medianPrice ? manwon(s.medianPrice) : '–'} note={s ? `문의 ${s.questions}건 · 의뢰 ${s.orders}건` : ''} />
      </section>

      {t && t.byTrack.length > 1 && (
        <section aria-label="인증 방식" className="mt-3 rounded-3xl border border-hairline bg-surface-canvas px-5 py-4">
          <p className="text-xs font-medium text-ink-500">검증된 전문가는 어떤 근거로 인증받았나</p>
          <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-surface-raised">
            {t.byTrack.map((b, i) => (
              <span
                key={b.track}
                title={`${b.label} ${b.experts}명`}
                className={['bg-brand-sage', 'bg-brand-gold', 'bg-brand-clay', 'bg-ink-400'][i % 4]}
                style={{ width: `${(b.experts / Math.max(1, t.byTrack.reduce((n, x) => n + x.experts, 0))) * 100}%` }}
              />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-700">
            {t.byTrack.map((b, i) => (
              <li key={b.track} className="inline-flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-sm ${['bg-brand-sage', 'bg-brand-gold', 'bg-brand-clay', 'bg-ink-400'][i % 4]}`} />
                {b.label} <b className="tabular-nums">{b.experts}명</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      {s && s.byDomain.length > 0 && (
        <section aria-label="분야별 상품 수" className="mt-3 flex flex-wrap gap-2">
          {s.byDomain.map((d) => (
            <button
              key={d.domainType}
              type="button"
              onClick={() => setDomain(domain === d.domainType ? '' : d.domainType)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                domain === d.domainType ? 'border-brand-sage bg-brand-sage text-white' : 'border-hairline bg-surface-canvas text-ink-700 hover:border-brand-sage/50'
              }`}
            >
              {d.label} <b className="tabular-nums">{d.count}</b>
            </button>
          ))}
        </section>
      )}

      <JangdanDivider />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-ink-700 outline-none focus:border-brand-sage"
        >
          <option value="">모든 분야</option>
          {DOMAIN_OPTIONS.map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as 'latest' | 'popular' | 'cheap')}
          className="rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-ink-700 outline-none focus:border-brand-sage"
        >
          <option value="latest">최신순</option>
          <option value="popular">문의·의뢰 많은 순</option>
          <option value="cheap">낮은 가격순</option>
        </select>
      </div>

      {loading && (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-3xl bg-surface-raised" />
          ))}
        </div>
      )}

      {!loading && failed && <p className="mt-6 text-sm text-brand-red">상품을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}

      {!loading && !failed && data && data.items.length === 0 && (
        <div className="mt-5 flex flex-col items-center gap-2 rounded-4xl border border-dashed border-hairline-strong bg-surface-canvas py-16 text-center">
          <Store size={28} className="text-ink-400" />
          <p className="text-sm text-ink-500">이 분야에는 아직 올라온 상품이 없어요.</p>
        </div>
      )}

      {!loading && data && data.items.length > 0 && (
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {data.items.map((o, i) => (
            <li key={o.id} style={jangdanDelay(i)} className="animate-stagger-in">
              <Link
                href={`/offers/${o.id}`}
                className="flex h-full flex-col rounded-3xl border border-hairline bg-surface-canvas p-4 shadow-sm transition-colors hover:border-brand-sage/60"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-surface-raised px-2.5 py-1 text-[11px] font-medium text-ink-600">{o.domainLabel}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-tint-sage px-2.5 py-1 text-[11px] font-semibold text-brand-sage">
                    <BadgeCheck size={12} /> 검증된 전문가{o.verification ? ` · ${o.verification.label}` : ''}
                  </span>
                </div>
                <div className="mt-2 flex gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="line-clamp-1 text-base font-semibold text-ink-900">{o.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-500">{o.excerpt}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-500">
                      <Star size={12} className="text-brand-gold" />
                      {o.rating ? <><b className="text-ink-900">{o.rating.avg}</b> / 10 · 후기 {o.rating.count}</> : '후기 아직 없음'}
                    </p>
                  </div>
                  {o.images[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.images[0]} alt="" className="h-20 w-20 flex-shrink-0 rounded-2xl border border-hairline object-cover" />
                  )}
                </div>
                <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                  <div>
                    <p className="font-display text-2xl tabular-nums text-ink-900">{won(o.price)}</p>
                    {o.domainAverage && (
                      <p className="text-[11px] text-ink-400">이 분야 의뢰 평균 {manwon(o.domainAverage)} ({o.domainAverageCount}건)</p>
                    )}
                  </div>
                  <div className="text-right text-xs text-ink-500">
                    <p className="font-medium text-ink-700">{o.expert.name}</p>
                    <p className="mt-0.5 inline-flex items-center gap-2">
                      <span className="inline-flex items-center gap-0.5"><Clock size={12} /> {o.days}일</span>
                      {o.area && <span className="inline-flex items-center gap-0.5"><MapPin size={12} /> {o.area}</span>}
                      <span className="inline-flex items-center gap-0.5"><MessageSquare size={12} /> {o.messageCount}</span>
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-ink-400">
        수수료는 거래가 끝나 정산될 때만 전문가가 내요({FEE_RULE_TEXT}, 최대 15%). 거래가 안 되면 0원이고, 의뢰인이 내는 돈은 상품 가격 그대로예요.
      </p>
    </div>
  );
}

function Tile({ icon, label, value, note, strong }: { icon: React.ReactNode; label: string; value: string; note: string; strong?: boolean }) {
  return (
    <div className={`rounded-3xl border p-4 ${strong ? 'border-brand-sage/40 bg-tint-sage' : 'border-hairline bg-surface-canvas'}`}>
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500">
        <span className={strong ? 'text-brand-sage' : 'text-ink-400'}>{icon}</span> {label}
      </p>
      <p className={`mt-1 font-display text-3xl tabular-nums ${strong ? 'text-brand-sage' : 'text-ink-900'}`}>{value}</p>
      <p className="mt-1 text-[11px] text-ink-500">{note}</p>
    </div>
  );
}
