'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, extractErrorMessage } from '@/lib/api';
import { DOMAIN_LABELS, MyDashboard, TRACK_LABELS } from '@/lib/types';
import { ApplicationStatusBadge, BountyStatusBadge } from '@/components/StatusBadge';

const CERT_STATUS_LABEL: Record<'PENDING' | 'APPROVED' | 'REJECTED', string> = {
  PENDING: '심사중',
  APPROVED: '승인됨',
  REJECTED: '반려됨',
};

/**
 * 마이페이지 통합 대시보드 (Task #31).
 * 여러 화면(바운티 목록, 자격 인증, 알림)에 흩어져 있던 "내 활동"을 GET
 * /dashboard/me 응답 하나로 한 번에 모아 보여준다 - dashboard.service.ts
 * (백엔드) 주석 참고. 화면 스타일은 기존 bounties/certifications 페이지의
 * 톤을 그대로 따르고, 별도 디자인 다듬기는 나중으로 미뤘다.
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

  if (loading) return <p className="text-sm text-slate-500">불러오는 중...</p>;
  if (error) return <p className="text-sm text-brand-red">{error}</p>;
  if (!data) return null;

  const { profile, summary, clientBounties, expertApplications, certifications } = data;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">마이페이지</h1>
        <p className="mt-1 text-sm text-slate-500">
          {profile.name}님 ({profile.email}) · 내가 등록한 바운티, 지원 현황, 자격 인증을 한 화면에서 확인해요.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        <SummaryTile label="등록한 바운티" value={summary.clientBountyCount} />
        <SummaryTile label="진행중" value={summary.clientBountyInProgressCount} />
        <SummaryTile label="지원한 바운티" value={summary.expertApplicationCount} />
        <SummaryTile label="선정됨" value={summary.expertSelectedCount} />
        <SummaryTile label="승인된 인증" value={summary.certificationApprovedCount} />
        <SummaryTile label="안 읽은 알림" value={summary.unreadNotificationCount} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">내가 등록한 바운티 ({clientBounties.length})</h2>
        {clientBounties.length === 0 && (
          <p className="text-sm text-slate-500">
            아직 등록한 바운티가 없어요.{' '}
            <Link href="/bounties/new" className="text-brand-teal underline">
              바운티 등록하러 가기
            </Link>
          </p>
        )}
        <ul className="space-y-2">
          {clientBounties.map((b) => (
            <li key={b.id}>
              <Link
                href={`/bounties/${b.id}`}
                className="flex items-center justify-between rounded border border-slate-200 bg-white p-4 hover:border-brand-teal"
              >
                <div>
                  <p className="text-xs text-slate-400">{DOMAIN_LABELS[b.domainType]}</p>
                  <p className="font-medium">{b.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{b.bountyAmount.toLocaleString()}원</p>
                </div>
                <BountyStatusBadge status={b.status} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">내가 지원한 바운티 ({expertApplications.length})</h2>
        {expertApplications.length === 0 && (
          <p className="text-sm text-slate-500">
            아직 지원한 바운티가 없어요.{' '}
            <Link href="/bounties" className="text-brand-teal underline">
              바운티 둘러보러 가기
            </Link>
          </p>
        )}
        <ul className="space-y-2">
          {expertApplications.map((a) => (
            <li key={a.id}>
              <Link
                href={`/bounties/${a.bountyId}`}
                className="flex items-center justify-between rounded border border-slate-200 bg-white p-4 hover:border-brand-teal"
              >
                <div>
                  {a.bounty && <p className="text-xs text-slate-400">{DOMAIN_LABELS[a.bounty.domainType]}</p>}
                  <p className="font-medium">{a.bounty?.title ?? '(삭제된 바운티)'}</p>
                  {a.message && <p className="mt-1 line-clamp-1 text-sm text-slate-500">{a.message}</p>}
                </div>
                <ApplicationStatusBadge status={a.status} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">내 자격 인증 현황 ({certifications.length})</h2>
        {certifications.length === 0 && (
          <p className="text-sm text-slate-500">
            아직 신청한 인증이 없어요.{' '}
            <Link href="/certifications" className="text-brand-teal underline">
              인증 신청하러 가기
            </Link>
          </p>
        )}
        <ul className="space-y-2">
          {certifications.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded border border-slate-200 bg-white p-4"
            >
              <div>
                <p className="font-medium">{DOMAIN_LABELS[c.domainType]}</p>
                <p className="text-sm text-slate-500">
                  {TRACK_LABELS[c.track]} · {c.licenseNumber}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  c.verifiedStatus === 'APPROVED'
                    ? 'bg-teal-50 text-brand-teal'
                    : c.verifiedStatus === 'REJECTED'
                      ? 'bg-red-50 text-brand-red'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {CERT_STATUS_LABEL[c.verifiedStatus]}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-4 text-center">
      <p className="text-2xl font-semibold text-brand-navy">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
