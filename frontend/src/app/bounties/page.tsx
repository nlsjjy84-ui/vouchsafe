'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusCircle, PackageSearch } from 'lucide-react';
import { api } from '@/lib/api';
import { Bounty, DOMAIN_LABELS, DomainType } from '@/lib/types';
import { BountyStatusBadge } from '@/components/StatusBadge';
import { jangdanDelay } from '@/lib/motion';

// 기획서 2장 도메인 카테고리 분류 - 카드 왼쪽 색상 띠로 어떤 영역인지 한눈에 구분하기 위함.
const DOMAIN_CATEGORY: Record<DomainType, 'A' | 'B' | 'C'> = {
  BACKEND_DB_TUNING: 'A',
  WEB3_SECURITY_AUDIT: 'A',
  DEV_CODE_REVIEW: 'A',
  CRAWLING_ARCHITECTURE: 'A',
  MOBILE_QA_AUTOMATION: 'A',
  TECH_CREATOR_CONSULTING: 'B',
  AUDIO_MASTERING_REVIEW: 'B',
  INDIE_GAME_QA: 'B',
  GRAPHICS_3D_OPTIMIZATION: 'B',
  VEHICLE_DIAGNOSTICS: 'B',
  BUILDING_DEFECT_INSPECTION: 'B',
  FIRE_SAFETY_INSPECTION: 'B',
  STARTUP_CONTRACT_REVIEW: 'C',
  TAX_STRUCTURE_FACTCHECK: 'C',
  REAL_ESTATE_TITLE_ANALYSIS: 'C',
};

const CATEGORY_BAR: Record<'A' | 'B' | 'C', string> = {
  A: 'bg-brand-teal',
  B: 'bg-brand-amber',
  C: 'bg-brand-blue',
};

/**
 * 바운티(일감) 목록 화면. 로그인만 하면 누구나 볼 수 있다.
 *
 * 참고: 백엔드 GET /api/bounties (BountiesController.findAll)는 페이지네이션 없이
 * 배열(Bounty[])을 그대로 내려준다 - { items, total, totalPages, ... } 형태가 아니다.
 * 그래서 여기서도 res.data를 바로 배열로 다룬다.
 */
export default function BountiesPage() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<Bounty[]>('/bounties')
      .then((res) => setBounties(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl tracking-wide text-ink-900">바운티 둘러보기</h1>
          <p className="mt-1 text-sm text-ink-500">
            검증된 전문가가 지원할 수 있는 일감이에요. 관심있는 분야를 찾아보세요.
          </p>
        </div>
        <Link
          href="/bounties/new"
          className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-tealDeep hover:shadow-md"
        >
          <PlusCircle size={16} /> 바운티 등록
        </Link>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-4xl bg-surface-raised" />
          ))}
        </div>
      )}

      {!loading && bounties.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-4xl border border-dashed border-hairline-strong bg-surface-canvas py-16 text-center">
          <PackageSearch size={28} className="text-ink-400" />
          <p className="text-sm text-ink-500">아직 등록된 바운티가 없어요.</p>
          <Link
            href="/bounties/new"
            className="mt-1 text-sm font-semibold text-brand-teal hover:underline"
          >
            첫 바운티를 등록해보세요 →
          </Link>
        </div>
      )}

      {/* 카드를 낱개로 쌓지 않고, 단일 컨테이너 안에 구분선으로 나눈 행(row) 목록으로
          - 채용 공고 게시판류 UI에서 흔한 "N개의 개별 카드" 패턴을 피하고, 왼쪽
          분야색 띠 + hover 시 배경색만 바뀌는 방식으로 목록임을 강조했다. */}
      <div className="divide-y divide-hairline overflow-hidden rounded-4xl border border-hairline bg-surface-canvas">
        {bounties.map((b, i) => (
          <Link
            key={b.id}
            href={`/bounties/${b.id}`}
            style={jangdanDelay(i)}
            className="animate-stagger-in group flex transition-colors hover:bg-surface-raised"
          >
            <span className={`w-1.5 flex-shrink-0 ${CATEGORY_BAR[DOMAIN_CATEGORY[b.domainType]]}`} />
            <div className="flex-1 p-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-ink-400">
                  {DOMAIN_LABELS[b.domainType]}
                </span>
                <BountyStatusBadge status={b.status} />
              </div>
              <h2 className="text-base font-semibold text-ink-900 group-hover:text-brand-teal">
                {b.title}
              </h2>
              <p className="mt-1 line-clamp-2 text-sm text-ink-500">{b.description}</p>
              <p className="mt-2 font-display text-base tracking-wide text-ink-900">
                {b.bountyAmount.toLocaleString('ko-KR')}원
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
