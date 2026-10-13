'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, PenSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { OfferDetail } from '@/lib/offer-types';
import { OfferForm } from '@/components/OfferForm';

/** 상품 고치기 (/offers/[id]/edit). 상품을 올린 전문가만 들어올 수 있다(서버도 막는다). */
export default function EditOfferPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [offer, setOffer] = useState<OfferDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .get<OfferDetail>(`/offers/${id}`)
      .then((res) => setOffer(res.data))
      .catch(() => setFailed(true));
  }, [id]);

  if (loading) return null;
  if (failed) return <p className="text-sm text-brand-red">상품을 찾을 수 없어요.</p>;
  if (!offer) return <div className="h-64 animate-pulse rounded-4xl bg-surface-raised" />;
  if (!user || user.id !== offer.expert.id) {
    return <p className="text-sm text-ink-500">이 상품을 올린 전문가만 고칠 수 있어요.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/offers/mine" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={15} /> 내 상품
      </Link>
      <div className="mb-5 mt-3 flex items-start gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-tint-sage text-brand-sage">
          <PenSquare size={20} />
        </span>
        <div>
          <h1 className="font-display text-2xl tracking-wide text-ink-900">상품 고치기</h1>
          <p className="mt-1 text-sm text-ink-500">사진은 바로 저장되고, 나머지는 아래 저장 버튼을 눌러야 바뀌어요.</p>
        </div>
      </div>
      <OfferForm mode="edit" domains={[offer.domainType]} initial={offer} onDone={(oid) => router.push(`/offers/${oid}`)} />
    </div>
  );
}
