'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { AvatarModule } from './AvatarModule';
import { NotificationBell } from './NotificationBell';

/**
 * Topbar — 사이드바 옆에 붙는 56px 높이의 얇은 상단 바.
 * 현재 화면 제목 + 알림/아바타/로그아웃만 담당한다 (전체 내비게이션은 Sidebar 쪽으로 옮김).
 *
 * v4 (concept-b/c 합의 반영): 제목 앞에 작은 원형 teal 점을 두어, 사이드바 로고칩·
 * 메뉴 pill과 같은 "원형(형태=c)" 언어를 톱바에도 아주 은은하게 이어붙였다.
 */

const PAGE_TITLES: Array<{ test: (p: string) => boolean; title: string }> = [
  { test: (p) => p === '/bounties', title: '프로젝트 둘러보기' },
  { test: (p) => p === '/bounties/new', title: '프로젝트 등록' },
  { test: (p) => p.startsWith('/bounties/'), title: '프로젝트 상세' },
  { test: (p) => p.startsWith('/insights'), title: 'AI 인사이트' },
  { test: (p) => p.startsWith('/certifications'), title: '전문가 인증' },
  { test: (p) => p.startsWith('/mypage'), title: '마이페이지' },
  { test: (p) => p.startsWith('/admin/disputes'), title: '분쟁 중재 (관리자)' },
  { test: (p) => p.startsWith('/admin/reports'), title: '신고 처리 (관리자)' },
  { test: (p) => p.startsWith('/admin/payouts'), title: '출금 처리 (관리자)' },
];

export function Topbar({ onMenuClick }: { onMenuClick?: () => void } = {}) {
  const { user, logout } = useAuth();
  const pathname = usePathname() ?? '';
  const title = PAGE_TITLES.find((p) => p.test(pathname))?.title ?? 'Vouchsafe';

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-hairline bg-surface-canvas/95 px-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="메뉴 열기"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-ink-700 hover:bg-surface-raised md:hidden"
        >
          <Menu size={20} />
        </button>
      )}
      <h1 className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold text-ink-900">
        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-clay" aria-hidden="true" />
        <span className="truncate">{title}</span>
        {user && /@demo\.com$/i.test(user.email) && (
          <span className="flex-shrink-0 rounded-full bg-tint-gold px-2 py-0.5 text-[10px] font-bold text-brand-gold">데모 계정</span>
        )}
      </h1>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
        <NotificationBell />
        {user && (
          <Link href="/mypage" className="flex items-center gap-2 rounded-full px-1 py-1 hover:bg-surface-raised">
            <AvatarModule name={user.email} role={user.role} size={28} />
          </Link>
        )}
        <button
          onClick={logout}
          title="로그아웃"
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink-400 hover:bg-tint-red hover:text-brand-red"
        >
          <LogOut size={16} strokeWidth={1.75} />
          <span className="hidden sm:inline">로그아웃</span>
        </button>
      </div>
    </header>
  );
}
