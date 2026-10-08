'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { BadgeCheck, CheckCircle2, Gauge, MapPin, PauseCircle, ShieldAlert, Star, Undo2, UserCheck, UserX } from 'lucide-react';
import { api } from '@/lib/api';
import { ExpertOutcome, ExpertProfile } from '@/lib/expert-types';
import { AvatarModule } from '@/components/AvatarModule';
import { JangdanDivider } from '@/components/JangdanDivider';
import { ExpertReviewSummary } from '@/components/ExpertReviewSummary';

/**
 * 전문가 공개 프로필 (/experts/:id) — 로그인 없이 볼 수 있다.
 * "이 사람을 믿어도 되는가"를 한 화면에서 판단하도록 인증 분야 · 시스템 점수 · 처리 이력 · 의뢰인 후기를 모았다.
 * 시스템 점수와 의뢰인 점수는 합치지 않고 나란히 둔다(거래 사례 화면과 같은 원칙).
 * 의뢰인의 이름·정확한 금액·위치는 어디에도 나오지 않는다.
 */
const OUTCOME_META: Record<ExpertOutcome, { label: string; cls: string; icon: React.ReactNode }> = {
  SUCCESS: { label: '성공', cls: 'bg-tint-sage text-brand-sage', icon: <CheckCircle2 size={12} /> },
  SUCCESS_AFTER_DISPUTE: { label: '분쟁 후 정산', cls: 'bg-tint-gold text-brand-gold', icon: <ShieldAlert size={12} /> },
  REFUNDED: { label: '환불(실패)', cls: 'bg-tint-red text-brand-red', icon: <Undo2 size={12} /> },
  ON_HOLD: { label: '보류', cls: 'bg-tint-clay text-brand-clay', icon: <PauseCircle size={12} /> },
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

export default function ExpertProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<ExpertProfile | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');

  useEffect(() => {
    setState('loading');
    api
      .get<ExpertProfile>(`/experts/${id}/profile`)
      .then((r) => {
        setP(r.data);
        setState('ok');
      })
      .catch(() => setState('missing'));
  }, [id]);

  if (state === 'loading') {
    return (
      <div className="space-y-3">
        <div className="h-40 animate-pulse rounded-4xl bg-surface-raised" />
        <div className="h-28 animate-pulse rounded-4xl bg-surface-raised" />
      </div>
    );
  }
  if (state === 'missing' || !p) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-4xl border border-dashed border-hairline-strong bg-surface-canvas py-16 text-center">
        <UserX size={28} className="text-ink-400" />
        <p className="text-sm text-ink-500">전문가를 찾을 수 없어요.</p>
        <Link href="/map" className="text-sm font-semibold text-brand-clay">지역 찾기로 돌아가기</Link>
      </div>
    );
  }

  const { reputation: rep, outcomes } = p;
  const total = outcomes.success + outcomes.successAfterDispute + outcomes.refunded + outcomes.onHold;
  const seg = (n: number) => (total ? `${(n / total) * 100}%` : '0%');

  return (
    <div>
      {/* 머리말 */}
      <div className="flex flex-wrap items-center gap-4 rounded-4xl border border-hairline bg-surface-canvas p-6 shadow-sm">
        <AvatarModule name={p.name} role={p.role} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl tracking-wide text-ink-900">{p.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
            {p.region && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} /> {p.region.text}
              </span>
            )}
            <span>{fmtDate(p.joinedAt)} 가입</span>
            <span className="inline-flex items-center gap-1">
              <UserCheck size={12} /> {p.verifiedDomains.length > 0 ? `인증 분야 ${p.verifiedDomains.length}개` : '승인된 인증 분야 없음'}
            </span>
          </div>
        </div>
      </div>

      {/* 점수는 합치지 않고 나란히 */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-hairline bg-tint-ink p-5">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-ink"><Gauge size={14} /> 시스템 점수</p>
          <p className="mt-2 font-display text-4xl text-ink-900">
            {rep.hasEnoughData ? rep.score10.toFixed(1) : '—'}
            <span className="ml-1 text-base text-ink-500">/ 10</span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink-600">
            {rep.hasEnoughData
              ? `완료율 ${Math.round(rep.completionRate * 100)}% · ${rep.disputeTotalCount > 0 ? `분쟁 ${rep.disputeTotalCount}건 중 ${rep.disputeWinCount}건 정산 유지` : '분쟁 없음'}${
                  rep.avgSettlementDays !== null ? ` · 평균 ${rep.avgSettlementDays.toFixed(1)}일 처리` : ''
                }`
              : '아직 결과가 난 거래가 없어서 점수가 없어요.'}
          </p>
          <p className="mt-1 text-[11px] text-ink-400">기록된 거래로 자동 계산돼요. 누구도 고칠 수 없어요.</p>
        </div>
        <div className="rounded-3xl border border-hairline bg-tint-gold p-5">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-gold"><Star size={14} /> 의뢰인 평균 점수</p>
          <p className="mt-2 font-display text-4xl text-ink-900">
            {p.avgClientRating !== null ? p.avgClientRating.toFixed(1) : '—'}
            <span className="ml-1 text-base text-ink-500">/ 10</span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink-600">
            {p.ratedCount > 0 ? `의뢰인 ${p.ratedCount}명이 직접 매긴 점수예요.` : '아직 의뢰인이 남긴 점수가 없어요.'}
          </p>
          <p className="mt-1 text-[11px] text-ink-400">정산 완료 후 의뢰인이 한 번만 남길 수 있어요.</p>
        </div>
      </div>

      {/* 처리 이력 */}
      <section className="mt-6">
        <h2 className="font-display text-lg text-ink-900">처리 이력</h2>
        {total === 0 ? (
          <p className="mt-2 text-sm text-ink-500">아직 결과가 공개된 거래가 없어요.</p>
        ) : (
          <>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-surface-raised">
              <span style={{ width: seg(outcomes.success) }} className="bg-brand-sage" />
              <span style={{ width: seg(outcomes.successAfterDispute) }} className="bg-brand-gold" />
              <span style={{ width: seg(outcomes.refunded) }} className="bg-brand-red" />
              <span style={{ width: seg(outcomes.onHold) }} className="bg-brand-clay" />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-700">
              <span>성공 <b className="font-display text-brand-sage">{outcomes.success}</b></span>
              <span>분쟁 후 정산 <b className="font-display text-brand-gold">{outcomes.successAfterDispute}</b></span>
              <span>환불(실패) <b className="font-display text-brand-red">{outcomes.refunded}</b></span>
              <span>보류 <b className="font-display text-brand-clay">{outcomes.onHold}</b></span>
            </div>
          </>
        )}
      </section>

      <JangdanDivider />

      {/* 인증 분야 */}
      <section className="mt-6">
        <h2 className="font-display text-lg text-ink-900">인증 분야</h2>
        {p.verifiedDomains.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">관리자가 승인한 인증 분야가 아직 없어요.</p>
        ) : (
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {p.verifiedDomains.map((d) => (
              <li key={d.domainType} className="rounded-3xl border border-hairline bg-surface-canvas p-4">
                <p className="inline-flex items-center gap-1 rounded-full bg-tint-clay px-2.5 py-1 text-[11px] font-bold text-brand-clay">
                  <BadgeCheck size={12} /> {d.domainLabel}
                </p>
                <p className="mt-2 text-xs text-ink-600">
                  이 분야 정산 완료 <b className="font-display text-ink-900">{d.completed}</b>건 · {fmtDate(d.verifiedSince)} 승인
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 의뢰인 후기 */}
      <section className="mt-8">
        <h2 className="font-display text-lg text-ink-900">의뢰인 후기 {p.ratedCount > 0 && <span className="text-sm text-ink-400">{p.ratedCount}</span>}</h2>
        {p.reviews.length > 0 && <ExpertReviewSummary expertId={p.id} />}
        {p.reviews.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">아직 후기가 없어요.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {p.reviews.map((r) => (
              <li key={r.id} className="rounded-3xl border border-hairline bg-surface-canvas p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                  <span className="inline-flex items-center gap-1 font-display text-base text-brand-gold"><Star size={14} /> {r.rating.toFixed(1)}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${OUTCOME_META[r.outcome].cls}`}>
                    {OUTCOME_META[r.outcome].icon} {OUTCOME_META[r.outcome].label}
                  </span>
                  <span>{r.domainLabel}</span>
                  <span className="ml-auto">{fmtDate(r.settledAt)}</span>
                </div>
                {r.note && <p className="mt-2 text-sm leading-relaxed text-ink-800">{r.note}</p>}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-ink-400">의뢰인의 이름과 정확한 금액은 공개되지 않아요.</p>
      </section>

      {/* 최근 거래 */}
      {p.recentCases.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg text-ink-900">최근 거래</h2>
          <div className="mt-3 overflow-x-auto rounded-3xl border border-hairline bg-surface-canvas">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs text-ink-500">
                <tr className="border-b border-hairline">
                  <th className="px-4 py-2 font-semibold">분야</th>
                  <th className="px-4 py-2 font-semibold">결과</th>
                  <th className="px-4 py-2 font-semibold">처리</th>
                  <th className="px-4 py-2 font-semibold">금액대</th>
                  <th className="px-4 py-2 font-semibold">의뢰인 점수</th>
                </tr>
              </thead>
              <tbody>
                {p.recentCases.map((c) => (
                  <tr key={c.id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-2 text-ink-800">{c.domainLabel}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${OUTCOME_META[c.outcome].cls}`}>
                        {OUTCOME_META[c.outcome].icon} {OUTCOME_META[c.outcome].label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-ink-700">{c.durationDays}일</td>
                    <td className="px-4 py-2 text-ink-700">{c.amountBand}</td>
                    <td className="px-4 py-2 font-display text-ink-900">{c.clientRating !== null ? c.clientRating.toFixed(1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-400">
            전체 거래는 <Link href="/cases" className="font-semibold text-brand-clay">거래 사례</Link>에서 익명으로 볼 수 있어요.
          </p>
        </section>
      )}
    </div>
  );
}
