'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DemoButtons } from '@/components/DemoButtons';
import { ArrowLeft, BadgeCheck, Clock, Lock, MapPin, MessageSquare, PenSquare, ShieldCheck, Star } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { SERVICE_TYPE_LABELS } from '@/lib/types';
import { timeAgo } from '@/lib/community-types';
import { OfferDetail, manwon, won } from '@/lib/offer-types';
import { FIELD_INPUT_CLASS, FormErrorText } from '@/components/FormControls';
import { ReportButton } from '@/components/ReportButton';

/**
 * 상품 상세 (/offers/[id]). 위에는 가격과 검증 근거를 숫자로, 아래에는 이 상품에만 달리는 문의·답변.
 * 문의는 커뮤니티 게시판에 섞이지 않는다. 연락처·직거래 표현은 서버가 막는다.
 * 「이 가격으로 의뢰하기」는 프로젝트 생성 + 이 전문가 선택 + 결제 대기까지 한 번에 만든다.
 */
export default function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [offer, setOffer] = useState<OfferDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'ask' | 'order' | 'close' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [orderErr, setOrderErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<OfferDetail>(`/offers/${id}`)
      .then((res) => setOffer(res.data))
      .catch(() => setFailed(true));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) { setErr('궁금한 점을 한 줄 적어 주세요. 예: 일정은 얼마나 걸리나요?'); return; }
    setBusy('ask');
    setErr(null);
    try {
      await api.post(`/offers/${id}/messages`, { content: text.trim() });
      setText('');
      load();
    } catch (e2) {
      setErr(extractErrorMessage(e2));
    } finally {
      setBusy(null);
    }
  }

  async function order() {
    setBusy('order');
    setOrderErr(null);
    try {
      const res = await api.post<{ bountyId: string }>(`/offers/${id}/order`, { note: note.trim() || undefined });
      router.push(`/bounties/${res.data.bountyId}`);
    } catch (e2) {
      setOrderErr(extractErrorMessage(e2));
      setBusy(null);
    }
  }

  async function close() {
    setBusy('close');
    try {
      await api.post(`/offers/${id}/close`);
      load();
    } catch (e2) {
      setOrderErr(extractErrorMessage(e2));
    } finally {
      setBusy(null);
    }
  }

  if (failed) return <p className="text-sm text-brand-red">상품을 찾을 수 없어요.</p>;
  if (!offer) return <div className="h-64 animate-pulse rounded-4xl bg-surface-raised" />;

  const mine = user?.id === offer.expert.id;
  const closed = offer.status !== 'ACTIVE';
  const diff = offer.domainAverage ? offer.price - offer.domainAverage : null;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/offers" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={15} /> 전문가 상품
      </Link>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <section className="min-w-0 rounded-4xl border border-hairline bg-surface-canvas p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-surface-raised px-2.5 py-1 text-[11px] font-medium text-ink-600">{offer.domainLabel}</span>
            <span className="rounded-full bg-surface-raised px-2.5 py-1 text-[11px] font-medium text-ink-600">{SERVICE_TYPE_LABELS[offer.serviceType]}</span>
            {closed && <span className="rounded-full bg-tint-red px-2.5 py-1 text-[11px] font-semibold text-brand-red">주문 마감</span>}
            {user && !mine && <span className="ml-auto"><ReportButton offerId={offer.id} /></span>}
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-ink-900">{offer.title}</h1>
          {offer.images.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {offer.images.map((src) => (
                <a key={src} href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-hairline">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="aspect-square w-full object-cover" />
                </a>
              ))}
            </div>
          )}
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-700">{offer.description}</p>
          <p className="mt-4 flex flex-wrap gap-4 text-xs text-ink-500">
            <span className="inline-flex items-center gap-1"><Clock size={13} /> 보통 {offer.days}일</span>
            {offer.area && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {offer.area}</span>}
            <span className="inline-flex items-center gap-1"><MessageSquare size={13} /> 문의 {offer.messageCount}</span>
          </p>
        </section>

        <aside className="space-y-3">
          <div className="rounded-4xl border border-hairline bg-surface-canvas p-5">
            <p className="text-xs text-ink-500">상품 가격</p>
            <p className="font-display text-3xl tabular-nums text-ink-900">{won(offer.price)}</p>
            {offer.domainAverage && diff !== null && (
              <p className="mt-1 text-xs text-ink-500">
                이 분야 의뢰 평균 {manwon(offer.domainAverage)}보다{' '}
                <b className={diff <= 0 ? 'text-brand-sage' : 'text-ink-700'}>{manwon(Math.abs(diff))} {diff <= 0 ? '저렴' : '높음'}</b>
              </p>
            )}
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-ink-700">
              <Star size={13} className="text-brand-gold" />
              {offer.rating ? <>상품 후기 <b>{offer.rating.avg}</b> / 10 · {offer.rating.count}개</> : '아직 상품 후기가 없어요'}
            </p>
            <p className="mt-2 text-[11px] text-ink-400">의뢰인은 이 가격만 결제해요. 결과를 승인해야 전문가에게 돈이 넘어가요.</p>

            {!closed && !mine && user && (
              <div className="mt-4 space-y-2">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="요청 메모 (예: 차종·연식, 원하는 날짜). 연락처는 적지 마세요."
                  className={FIELD_INPUT_CLASS}
                />
                {orderErr && <FormErrorText>{orderErr}</FormErrorText>}
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={order}
                  className="w-full rounded-full bg-brand-sage px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                >
                  {busy === 'order' ? '만드는 중…' : '이 가격으로 의뢰하기'}
                </button>
              </div>
            )}
            {!user && !closed && (
              <>
                <Link href="/login" className="mt-4 block rounded-full bg-brand-sage px-4 py-2.5 text-center text-sm font-semibold text-white">
                  로그인하고 의뢰하기
                </Link>
                <div className="mt-3"><DemoButtons tone="light" stayHere /></div>
              </>
            )}
            {mine && (
              <div className="mt-4 flex gap-2">
                <Link href={`/offers/${offer.id}/edit`} className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-brand-sage px-3 py-2 text-sm font-semibold text-white">
                  <PenSquare size={14} /> 고치기
                </Link>
                <Link href="/offers/mine" className="flex-1 rounded-full bg-surface-raised px-3 py-2 text-center text-sm font-semibold text-ink-700 hover:bg-hairline">
                  내 상품
                </Link>
              </div>
            )}
            {mine && !closed && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={close}
                className="mt-2 w-full rounded-full px-4 py-2 text-xs font-semibold text-ink-500 hover:bg-surface-raised"
              >
                주문 마감하기
              </button>
            )}
          </div>

          <div className="rounded-4xl border border-brand-sage/40 bg-tint-sage p-5">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-sage">
              <BadgeCheck size={16} /> 검증된 전문가
            </p>
            <p className="mt-2 text-base font-semibold text-ink-900">{offer.expert.name}</p>
            <ul className="mt-2 space-y-1 text-xs text-ink-700">
              <li className="inline-flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-brand-sage" /> {offer.domainLabel} 인증
                {offer.verification ? ` · ${offer.verification.label}` : ''}
              </li>
              <li className="flex items-center gap-1.5">
                <Lock size={13} className="text-brand-sage" /> 정산 완료 거래 {offer.expertCompleted}건
              </li>
              {offer.expertRating && (
                <li className="flex items-center gap-1.5">
                  <Star size={13} className="text-brand-sage" /> 모든 거래 의뢰인 평가 {offer.expertRating.avg} / 10 ({offer.expertRating.count}건)
                </li>
              )}
            </ul>
            <p className="mt-2 text-[11px] text-ink-500">자격번호 형식 검증과 서류 대조를 통과한 사람만 이 분야 상품을 올릴 수 있어요. 애매한 건은 관리자가 직접 심사해요.</p>
          </div>
        </aside>
      </div>

      <section className="mt-6 rounded-4xl border border-hairline bg-surface-canvas p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-base font-semibold text-ink-900">상품 후기 {offer.reviews.length}</h2>
          {offer.rating && (
            <p className="text-sm text-ink-700">
              평균 <b className="font-display text-xl tabular-nums text-ink-900">{offer.rating.avg}</b> / 10
            </p>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-500">이 상품으로 의뢰해서 정산까지 끝난 의뢰인만 남길 수 있어요. 남긴 후기는 고치거나 지울 수 없어요.</p>
        {offer.reviews.length === 0 ? (
          <p className="mt-4 text-sm text-ink-400">
            아직 후기가 없어요.{offer.expertRating ? ` 이 전문가가 다른 거래에서 받은 평가는 평균 ${offer.expertRating.avg} / 10 (${offer.expertRating.count}건)이에요.` : ''}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {offer.reviews.map((r) => (
              <li key={r.id} className="rounded-2xl bg-surface-raised px-4 py-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                  <span className="inline-flex items-center gap-1 font-semibold text-ink-900">
                    <Star size={12} className="text-brand-gold" /> {r.rating} / 10
                  </span>
                  <span>{r.author}</span>
                  <span>{timeAgo(r.settledAt)}</span>
                </p>
                {r.note && <p className="mt-1 whitespace-pre-line text-ink-700">{r.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-4xl border border-hairline bg-surface-canvas p-6">
        <h2 className="text-base font-semibold text-ink-900">문의 {offer.messages.length}</h2>
        <p className="mt-1 text-xs text-ink-500">이 상품에만 달리는 문의예요. 연락처·직거래 이야기는 올라가지 않아요. 연락은 의뢰 뒤 안심번호로 해요.</p>
        <ul className="mt-4 space-y-3">
          {offer.messages.map((m) => (
            <li
              key={m.id}
              className={`rounded-2xl px-4 py-3 text-sm ${m.isExpert ? 'ml-6 border border-brand-sage/30 bg-tint-sage' : 'mr-6 bg-surface-raised'}`}
            >
              <p className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                <b className="text-ink-900">{m.author.name}</b>
                {m.isExpert && <span className="rounded-full bg-brand-sage px-2 py-0.5 text-[10px] font-semibold text-white">전문가 답변</span>}
                <span>{timeAgo(m.createdAt)}</span>
              </p>
              <p className={`mt-1 whitespace-pre-line ${m.hidden ? 'italic text-ink-400' : 'text-ink-700'}`}>{m.content}</p>
              {user && user.id !== m.author.id && !m.hidden && (
                <div className="mt-1 flex justify-end">
                  <ReportButton offerId={offer.id} messageId={m.id} small />
                </div>
              )}
            </li>
          ))}
          {offer.messages.length === 0 && <li className="text-sm text-ink-400">아직 문의가 없어요.</li>}
        </ul>

        {user && !closed ? (
          <form onSubmit={ask} className="mt-4 space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={mine ? '문의에 답변을 남겨 주세요' : '궁금한 점을 물어보세요 (일정, 범위, 준비물 등)'}
              className={FIELD_INPUT_CLASS}
            />
            {err && <FormErrorText>{err}</FormErrorText>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busy !== null}
                className="rounded-full bg-brand-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy === 'ask' ? '남기는 중…' : mine ? '답변 남기기' : '문의 남기기'}
              </button>
            </div>
          </form>
        ) : (
          !user && (
            <>
              <Link href="/login" className="mt-4 inline-block text-sm font-medium text-brand-sage hover:underline">
                로그인하고 문의하기
              </Link>
              <div className="mt-3"><DemoButtons tone="light" stayHere /></div>
            </>
          )
        )}
      </section>
    </div>
  );
}
