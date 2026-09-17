'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
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
  { test: (p) => p === '/bounties', title: '바운티 둘러보기' },
  { test: (p) => p === '/bounties/new', title: '바운티 등록' },
  { test: (p) => p.startsWith('/bounties/'), title: '바운티 상세' },
  { test: (p) => p.startsWith('/insights'), title: 'AI 인사이트' },
  { test: (p) => p.startsWith('/certifications'), title: '전문가 인증' },
  { test: (p) => p.startsWith('/mypage'), title: '마이페이지' },
  { test: (p) => p.startsWith('/admin/disputes'), title: '분쟁 중재 (관리자)' },
];

export function Topbar({ onMenuClick }: { onMenuClick?: () => void } = {}) {
  const { user, logout } = useAuth();
  const pathname = usePathname() ?? '';
  const title = PAGE_TITLES.find((p) => p.test(pathname))?.title ?? 'CredoBounty';

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-hairline bg-surface-canvas/95 px-4 backdrop-blur">
      <h1 className="flex items-center gap-2 truncate text-sm font-semibold text-ink-900">
        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-teal" aria-hidden="true" />
        {title}
      </h1>

      <div className="flex items-center gap-3">
        <NotificationBell />
        {user && (
          <Link href="/mypage" className="flex items-center gap-2 rounded-full px-1 py-1 hover:bg-surface-raised">
            <AvatarModule name={user.email} role={user.role} size={28} />
          </Link>
        )}
        <button
          onClick={logout}
          title="로그아웃"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-400 hover:bg-tint-red hover:text-brand-red"
        >
          <LogOut size={16} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
