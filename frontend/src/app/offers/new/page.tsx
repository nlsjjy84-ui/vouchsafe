'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BadgeCheck, PackagePlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { DomainType } from '@/lib/types';
import { OfferForm } from '@/components/OfferForm';
import { OfferGuide } from '@/components/OfferGuide';

interface MyCert {
  domainType: DomainType;
  verifiedStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
}

/** 상품 올리기 (/offers/new). 인증이 승인된 분야만 고를 수 있다(서버도 한 번 더 막는다). */
export default function NewOfferPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [domains, setDomains] = useState<DomainType[] | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .get<MyCert[]>('/certifications/me')
      .then((res) => setDomains(Array.from(new Set(res.data.filter((c) => c.verifiedStatus === 'APPROVED').map((c) => c.domainType)))))
      .catch(() => setDomains([]));
  }, [user]);

  if (loading) return null;
  if (!user) {
    return (
      <p className="text-sm text-ink-500">
        <Link href="/login" className="font-semibold text-brand-sage">로그인</Link>한 뒤에 상품을 올릴 수 있어요.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-tint-sage text-brand-sage">
          <PackagePlus size={20} />
        </span>
        <div>
          <h1 className="font-display text-2xl tracking-wide text-ink-900">상품 올리기</h1>
          <p className="mt-1 text-sm text-ink-500">인증이 승인된 분야만 올릴 수 있어요. 열어 둘 수 있는 상품은 5개, 10분에 하나씩 올릴 수 있어요.</p>
        </div>
      </div>

      {domains === null ? (
        <div className="h-64 animate-pulse rounded-4xl bg-surface-raised" />
      ) : domains.length === 0 ? (
        <div className="rounded-4xl border border-dashed border-hairline-strong bg-surface-canvas p-8 text-center">
          <BadgeCheck size={28} className="mx-auto text-ink-400" />
          <p className="mt-2 text-sm text-ink-700">아직 승인된 전문가 인증이 없어요.</p>
          <p className="mt-1 text-xs text-ink-500">검증된 전문가만 상품을 올릴 수 있어요. 자격 서류를 먼저 제출해 주세요.</p>
          <Link href="/certifications" className="mt-4 inline-block rounded-full bg-brand-sage px-4 py-2 text-sm font-semibold text-white">
            전문가 인증 신청하기
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <OfferGuide />
          <OfferForm mode="create" domains={domains} onDone={(id) => router.push(`/offers/${id}`)} />
        </div>
      )}
    </div>
  );
}
