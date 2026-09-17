'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  ClipboardList,
  Send,
  CheckCircle2,
  ShieldCheck,
  Bell,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { DOMAIN_LABELS, MyDashboard, TRACK_LABELS } from '@/lib/types';
import { ApplicationStatusBadge, BountyStatusBadge } from '@/components/StatusBadge';
import { AvatarModule } from '@/components/AvatarModule';
import { jangdanDelay } from '@/lib/motion';

const CERT_STATUS_LABEL: Record<'PENDING' | 'APPROVED' | 'REJECTED', string> = {
  PENDING: '심사중',
  APPROVED: '승인됨',
  REJECTED: '반려됨',
};

const CERT_STATUS_STYLE: Record<'PENDING' | 'APPROVED' | 'REJECTED', string> = {
  PENDING: 'bg-surface-raised text-ink-500',
  APPROVED: 'bg-tint-teal text-brand-teal',
  REJECTED: 'bg-tint-red text-brand-red',
};

/**
 * 마이페이지 통합 대시보드 (Task #31).
 * 여러 화면(바운티 목록, 자격 인증, 알림)에 흩어져 있던 "내 활동"을 GET
 * /dashboard/me 응답 하나로 한 번에 모아 보여준다 - dashboard.service.ts
 * (백엔드) 참고. UI 리뉴얼(Phase 2)에서 카드형 요약 타일 + AI 인사이트 바로가기로
 * 다시 다듬었다.
 */
export default function MyPage() {
  const [data, setData] = useState<MyDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<MyDashboard>('/dashboard/me')
      .then((res) => setData(res.data))
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-4xl bg-surface-raised" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-4xl bg-surface-raised" />
          ))}
        </div>
      </div>
    );
  }
  if (error) return <p className="text-sm text-brand-red">{error}</p>;
  if (!data) return null;

  const { profile, summary, clientBounties, expertApplications, certifications } = data;

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-4xl border border-hairline bg-brand-navy text-white">
        <div className="flex items-center gap-4 p-5">
          <AvatarModule name={profile.name || profile.email} role={profile.role} size={48} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg tracking-wide">{profile.name}님</h1>
            <p className="truncate text-sm text-white/60">{profile.email}</p>
          </div>
          {/* AI 관련 진입점은 사이드바의 "AI 도구" 그룹과 같은 blue 톤을 써서, 이 버튼을
              누르면 "AI 성격의 기능"으로 이동한다는 걸 색으로도 먼저 알 수 있게 했다
              (기존엔 다른 모든 버튼과 똑같이 teal이라 구분이 안 됐다). */}
          <Link
            href="/insights"
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-brand-blue px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:brightness-90"
          >
            <Sparkles size={14} /> AI 인사이트 보기
          </Link>
        </div>
        {/* 요약 통계 - 6개의 개별 카드 대신, 헤더와 한 몸인 단일 스탯 바 안에 세로
            구분선만 그어 나열한다 (Toss 계좌 요약 바 패턴 참고). */}
        <div className="flex divide-x divide-white/10 overflow-x-auto border-t border-white/10 bg-white/[0.04]">
          <SummaryTile index={0} icon={Briefcase} label="등록한 바운티" value={summary.clientBountyCount} tone="blue" />
          <SummaryTile index={1} icon={ClipboardList} label="진행중" value={summary.clientBountyInProgressCount} tone="amber" />
          <SummaryTile index={2} icon={Send} label="지원한 바운티" value={summary.expertApplicationCount} tone="blue" />
          <SummaryTile index={3} icon={CheckCircle2} label="선정됨" value={summary.expertSelectedCount} tone="teal" />
          <SummaryTile index={4} icon={ShieldCheck} label="승인된 인증" value={summary.certificationApprovedCount} tone="teal" />
          <SummaryTile index={5} icon={Bell} label="안 읽은 알림" value={summary.unreadNotificationCount} tone="red" />
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-base font-semibold text-ink-900">
          내가 등록한 바운티 <span className="text-ink-400">({clientBounties.length})</span>
        </h2>
        {clientBounties.length === 0 ? (
          <EmptyRow href="/bounties/new" text="아직 등록한 바운티가 없어요." cta="바운티 등록하러 가기" />
        ) : (
          <div className="divide-y divide-hairline overflow-hidden rounded-4xl border border-hairline bg-surface-canvas">
            {clientBounties.map((b) => (
              <Link
                key={b.id}
                href={`/bounties/${b.id}`}
                className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-surface-raised"
              >
                <div className="min-w-0">
                  <p className="text-xs text-ink-400">{DOMAIN_LABELS[b.domainType]}</p>
                  <p className="truncate font-medium text-ink-900">{b.title}</p>
                  <p className="mt-1 text-sm text-ink-500">{b.bountyAmount.toLocaleString('ko-KR')}원</p>
                </div>
                <BountyStatusBadge status={b.status} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-ink-900">
          내가 지원한 바운티 <span className="text-ink-400">({expertApplications.length})</span>
        </h2>
        {expertApplications.length === 0 ? (
          <EmptyRow href="/bounties" text="아직 지원한 바운티가 없어요." cta="바운티 둘러보러 가기" />
        ) : (
          <div className="divide-y divide-hairline overflow-hidden rounded-4xl border border-hairline bg-surface-canvas">
            {expertApplications.map((a) => (
              <Link
                key={a.id}
                href={`/bounties/${a.bountyId}`}
                className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-surface-raised"
              >
                <div className="min-w-0">
                  {a.bounty && <p className="text-xs text-ink-400">{DOMAIN_LABELS[a.bounty.domainType]}</p>}
                  <p className="truncate font-medium text-ink-900">{a.bounty?.title ?? '(삭제된 바운티)'}</p>
                  {a.message && <p className="mt-1 line-clamp-1 text-sm text-ink-500">{a.message}</p>}
                </div>
                <ApplicationStatusBadge status={a.status} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-ink-900">
          내 자격 인증 현황 <span className="text-ink-400">({certifications.length})</span>
        </h2>
        {certifications.length === 0 ? (
          <EmptyRow href="/certifications" text="아직 신청한 인증이 없어요." cta="인증 신청하러 가기" />
        ) : (
          <div className="divide-y divide-hairline overflow-hidden rounded-4xl border border-hairline bg-surface-canvas">
            {certifications.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-ink-900">{DOMAIN_LABELS[c.domainType]}</p>
                  <p className="text-sm text-ink-500">
                    {TRACK_LABELS[c.track]} · {c.licenseNumber}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${CERT_STATUS_STYLE[c.verifiedStatus]}`}>
                  {CERT_STATUS_LABEL[c.verifiedStatus]}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryTile({
  index,
  icon: Icon,
  label,
  value,
  tone,
}: {
  index: number;
  icon: typeof Briefcase;
  label: string;
  value: number;
  tone: 'blue' | 'teal' | 'amber' | 'red';
}) {
  // 어두운 헤더(bg-brand-navy) 위에 얹히는 스탯 바라서, 일반 브랜드 색보다 한 단계 밝은 색으로 대비를 맞췄다.
  const toneClass = {
    blue: 'text-[#7dabff]',
    teal: 'text-[#2dd4bf]',
    amber: 'text-[#fbbf24]',
    red: 'text-[#f87171]',
  }[tone];

  return (
    <div
      style={jangdanDelay(index)}
      className="animate-stagger-in min-w-[104px] flex-1 p-4 text-center"
    >
      <Icon size={15} strokeWidth={1.75} className={`mx-auto mb-1.5 ${toneClass}`} />
      <p className="font-display text-xl tracking-wide">{value}</p>
      <p className="mt-0.5 text-[11px] text-white/60">{label}</p>
    </div>
  );
}

function EmptyRow({ href, text, cta }: { href: string; text: string; cta: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-4xl border border-dashed border-hairline-strong p-5 text-sm text-ink-500 hover:border-brand-teal hover:text-brand-teal"
    >
      <span>{text}</span>
      <span className="flex items-center gap-1 font-medium">
        {cta} <ArrowRight size={14} />
      </span>
    </Link>
  );
}
