'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { AvatarModule } from './AvatarModule';
import { NotificationBell } from './NotificationBell';
import { JangdanMark } from './JangdanMark';

export function Navbar() {
  const { user, logout, loading } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-brand-navy text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/bounties" className="flex items-center gap-2.5">
          <JangdanMark size={18} variant="dark" />
          <span className="text-lg font-semibold">CredoBounty</span>
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/bounties" className="hover:text-brand-teal">
            바운티 둘러보기
          </Link>
          <Link href="/cases" className="hover:text-brand-teal">
            거래 사례
          </Link>

          {!loading && user && (
            <>
              <Link href="/bounties/new" className="hover:text-brand-teal">
                바운티 등록
              </Link>
              <Link href="/certifications" className="hover:text-brand-teal">
                전문가 인증
              </Link>
              <Link href="/mypage" className="hover:text-brand-teal">
                마이페이지
              </Link>
              <NotificationBell />
              <div className="flex items-center gap-2">
                <AvatarModule name={user.email} role={user.role} size={28} />
                <button onClick={logout} className="text-slate-300 hover:text-white">
                  로그아웃
                </button>
              </div>
            </>
          )}

          {!loading && !user && (
            <>
              <Link href="/login" className="hover:text-brand-teal">
                로그인
              </Link>
              <Link
                href="/register"
                className="rounded bg-brand-teal px-3 py-1.5 font-medium text-white hover:opacity-90"
              >
                회원가입
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
