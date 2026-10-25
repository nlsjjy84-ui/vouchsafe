'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { JangdanLanding, LandingStats } from '@/components/landing/JangdanLanding';

/**
 * 서비스 소개(랜딩) 화면.
 *
 * 로그인한 사용자는 /bounties로 보내고, 로그아웃 상태에서는 장단 리듬 이야기 랜딩을 보여 준다.
 * 숫자(검증된 전문가 · 반려 · 정산 · 수수료 비교)는 /stats/home의 실제 값을 쓴다.
 * 무료 서버가 잠들어 있으면 인증 확인(/auth/me)이 깨어나는 데 10초 안팎 걸리는데,
 * 그동안 빈 화면 대신 "서버를 깨우는 중" 안내를 보여 준다(2026-10-25).
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

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          padding: '24px',
          textAlign: 'center',
          background: '#17120f',
          color: '#f4ede4',
        }}
      >
        <style>{"@keyframes credo-spin{to{transform:rotate(360deg)}}"}</style>
        <div
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            border: '4px solid rgba(217,122,78,0.25)',
            borderTopColor: '#d97a4e',
            animation: 'credo-spin 0.9s linear infinite',
          }}
        />
        <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>
          잠시만요 — 서버를 깨우는 중입니다
        </div>
        <div style={{ fontSize: '0.88rem', color: '#b9ad9d', lineHeight: 1.6, maxWidth: '320px' }}>
          무료 서버라 처음 열 때 10~20초쯤 걸릴 수 있어요.
          <br />
          잠시 뒤 자동으로 CREDO 첫 화면이 나타납니다.
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return <JangdanLanding stats={stats} />;
}
