'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { JangdanLanding, LandingStats } from '@/components/landing/JangdanLanding';

/**
 * 서비스 소개(랜딩) 화면.
 *
 * 로그인한 사용자는 /bounties로 보내고, 로그아웃 상태에서는 장단 리듬 이야기 랜딩을 보여 준다
 * (2026-10-17: 카드·박스를 나열하던 소개 화면을, 스크롤에 따라 한 장면이 이어지는 3D 이야기로 바꿨다).
 * 숫자(검증된 전문가 · 반려 · 정산 · 수수료 비교)는 /stats/home의 실제 값을 쓴다.
 */
export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<LandingStats | null>(null);

  useEffect(() => {
    api.get<LandingStats>('/stats/home').then((r) => setStats(r.data)).catch(() => setStats(null));
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/bounties');
    }
  }, [loading, user, router]);

  if (loading || user) {
    return null;
  }

  return <JangdanLanding stats={stats} />;
}
