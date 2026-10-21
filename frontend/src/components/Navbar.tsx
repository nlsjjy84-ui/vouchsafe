'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { AvatarModule } from './AvatarModule';
import { NotificationBell } from './NotificationBell';
import { JangdanMark } from './JangdanMark';
import { DemoButtons } from './DemoButtons';

const PUBLIC_LINKS = [
  { href: '/bounties', label: '프로젝트 둘러보기' },
  { href: '/offers', label: '전문가 상품' },
  { href: '/cases', label: '거래 사례' },
  { href: '/map', label: '지역 찾기' },
  { href: '/community', label: '커뮤니티' },
  { href: '/matching', label: 'AI 매칭' },
];

const USER_LINKS = [
  { href: '/bounties/new', label: '프로젝트 등록' },
  { href: '/certifications', label: '전문가 인증' },
  { href: '/mypage', label: '마이페이지' },
];

// 2026-10-11: 폰(768px 미만)에서는 메뉴 7개가 한 줄에 몰려 "프로젝트 둘러보기"가 한 글자씩
// 세로로 쪼개졌다. 넓은 화면은 그대로 두고, 좁은 화면은 메뉴 버튼 하나로 접어 아래로 펼친다.
export function Navbar() {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="relative border-b border-hairline bg-brand-ink text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/bounties" className="flex items-center gap-2.5">
          <JangdanMark size={18} variant="dark" />
          <span className="text-lg font-semibold">CREDO</span>
        </Link>

        <nav className="hidden items-center gap-4 whitespace-nowrap text-sm md:flex">
          {PUBLIC_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-brand-clay">
              {l.label}
            </Link>
          ))}

          {!loading && user && (
            <>
              {USER_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="hover:text-brand-clay">
                  {l.label}
                </Link>
              ))}
              <NotificationBell />
              <div className="flex items-center gap-2">
                <AvatarModule name={user.email} role={user.role} size={28} />
                <button onClick={logout} className="text-ink-400 hover:text-white">
                  로그아웃
                </button>
              </div>
            </>
          )}

          {!loading && !user && (
            <>
              <Link href="/login" className="hover:text-brand-clay">
                로그인
              </Link>
              <Link
                href="/register"
                className="rounded bg-brand-clay px-3 py-1.5 font-medium text-white hover:opacity-90"
              >
                회원가입
              </Link>
            </>
          )}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 md:hidden"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="absolute inset-x-0 top-full z-40 border-b border-white/10 bg-brand-ink px-4 pb-5 pt-2 shadow-xl md:hidden">
          <nav className="flex flex-col text-base">
            {[...PUBLIC_LINKS, ...(user ? USER_LINKS : [])].map((l) => (
              <Link key={l.href} href={l.href} className="rounded-lg px-2 py-3 hover:bg-white/10">
                {l.label}
              </Link>
            ))}
          </nav>
          {!loading && !user && (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link href="/login" className="rounded-full border border-white/30 py-2.5 text-center text-sm font-medium">
                  로그인
                </Link>
                <Link href="/register" className="rounded-full bg-brand-clay py-2.5 text-center text-sm font-semibold">
                  회원가입
                </Link>
              </div>
              <div className="mt-4 border-t border-white/10 pt-4">
                <DemoButtons tone="dark" onDone={() => setOpen(false)} />
              </div>
            </>
          )}
          {!loading && user && (
            <button onClick={logout} className="mt-3 w-full rounded-full border border-white/30 py-2.5 text-sm">
              로그아웃
            </button>
          )}
        </div>
      )}
    </header>
  );
}
