'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Compass,
  PlusCircle,
  ShieldCheck,
  LayoutDashboard,
  Sparkles,
  Gavel,
  ScrollText,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { JangdanMark } from './JangdanMark';
import { jangdanDelay } from '@/lib/motion';

/**
 * =========================================================================
 * Sidebar — 로그인 후 화면(Authenticated Shell)의 좌측 고정 메뉴.
 * =========================================================================
 * v3 리뉴얼: "메뉴 안에 메뉴, 카테고리를 다르게 표현해보자"는 피드백에 대한 답으로
 * 메뉴를 하나의 평평한 목록이 아니라 [탐색 / AI 도구 / 내 활동 / 관리자] 4개
 * 카테고리로 나누고, 각 카테고리마다 고유한 색(pill 라벨 + 아이콘 배지 색)을
 * 부여했다. 활성 상태일 때만 색이 보이던 기존 방식과 달리, 평소에도 아이콘
 * 배지가 옅은 톤으로 항상 색을 띠고 있어서 "이 메뉴는 어떤 성격의 기능인지"를
 * 굳이 읽지 않아도 색으로 먼저 인지할 수 있게 했다.
 *
 * 접힘 상태는 부모(AppShell)가 들고 있다 - Topbar/본문 여백도 같이 맞춰 밀어줘야
 * 해서, 사이드바 혼자 상태를 감추고 있으면 안 되기 때문이다.
 * =========================================================================
 */

type NavTone = 'teal' | 'blue' | 'amber' | 'red';

interface NavItem {
  href: string;
  label: string;
  icon: typeof Compass;
  match: (p: string) => boolean;
  badge?: string;
}

interface NavGroup {
  label: string;
  tone: NavTone;
  items: NavItem[];
}

const TONE_STYLES: Record<NavTone, { labelPill: string; iconIdle: string; iconActive: string; activeBg: string; activeText: string }> = {
  teal: {
    labelPill: 'bg-tint-clay text-brand-clay',
    iconIdle: 'bg-tint-clay text-brand-clay',
    iconActive: 'bg-brand-clay text-white',
    activeBg: 'bg-tint-clay',
    activeText: 'text-brand-clay',
  },
  blue: {
    labelPill: 'bg-tint-sage text-brand-sage',
    iconIdle: 'bg-tint-sage text-brand-sage',
    iconActive: 'bg-brand-sage text-white',
    activeBg: 'bg-tint-sage',
    activeText: 'text-brand-sage',
  },
  amber: {
    labelPill: 'bg-tint-gold text-brand-gold',
    iconIdle: 'bg-tint-gold text-brand-gold',
    iconActive: 'bg-brand-gold text-white',
    activeBg: 'bg-tint-gold',
    activeText: 'text-brand-gold',
  },
  red: {
    labelPill: 'bg-tint-red text-brand-red',
    iconIdle: 'bg-tint-red text-brand-red',
    iconActive: 'bg-brand-red text-white',
    activeBg: 'bg-tint-red',
    activeText: 'text-brand-red',
  },
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: '탐색',
    tone: 'teal',
    items: [
      { href: '/bounties', label: '바운티 둘러보기', icon: Compass, match: (p) => p === '/bounties' },
      { href: '/cases', label: '거래 사례', icon: ScrollText, match: (p) => p.startsWith('/cases') },
    ],
  },
  {
    label: 'AI 도구',
    tone: 'blue',
    items: [
      { href: '/insights', label: 'AI 인사이트', icon: Sparkles, match: (p) => p.startsWith('/insights'), badge: 'AI' },
    ],
  },
  {
    label: '내 활동',
    tone: 'amber',
    items: [
      { href: '/bounties/new', label: '바운티 등록', icon: PlusCircle, match: (p) => p === '/bounties/new' },
      { href: '/certifications', label: '전문가 인증', icon: ShieldCheck, match: (p) => p.startsWith('/certifications') },
      { href: '/mypage', label: '마이페이지', icon: LayoutDashboard, match: (p) => p.startsWith('/mypage') },
    ],
  },
];

const ADMIN_GROUP: NavGroup = {
  label: '관리자',
  tone: 'red',
  items: [{ href: '/admin/disputes', label: '분쟁 중재', icon: Gavel, match: (p) => p.startsWith('/admin/disputes') }],
};

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { user } = useAuth();
  const pathname = usePathname() ?? '';
  const isAdmin = user?.role === 'ADMIN';
  const width = collapsed ? 'w-16' : 'w-64';
  const groups = isAdmin ? [...NAV_GROUPS, ADMIN_GROUP] : NAV_GROUPS;

  let flatIndex = 0;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex ${width} flex-col border-r border-hairline bg-surface-canvas transition-[width] duration-200`}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-hairline px-4">
        <JangdanMark size={18} />
        {!collapsed && <span className="truncate font-display text-base tracking-wide text-ink-900">CredoBounty</span>}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
        {groups.map((group) => {
          const tone = TONE_STYLES[group.tone];
          return (
            <div key={group.label}>
              {!collapsed ? (
                <span className={`mb-1.5 ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${tone.labelPill}`}>
                  {group.label}
                </span>
              ) : (
                <div className="mb-1.5 flex justify-center">
                  <span className={`h-1 w-4 rounded-full ${tone.labelPill}`} />
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = item.match(pathname);
                  const Icon = item.icon;
                  const i = flatIndex++;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      style={jangdanDelay(i)}
                      className={`animate-stagger-in group flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
                        active ? `${tone.activeBg} ${tone.activeText}` : 'text-ink-700 hover:bg-surface-raised hover:text-ink-900'
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${
                          active ? tone.iconActive : tone.iconIdle
                        }`}
                      >
                        <Icon size={15} strokeWidth={1.75} />
                      </span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {!collapsed && item.badge && (
                        <span className="ml-auto rounded-full bg-brand-clay/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-clay">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <button
        onClick={onToggle}
        className="flex items-center gap-2 border-t border-hairline px-4 py-3 text-xs font-medium text-ink-500 hover:bg-surface-raised hover:text-ink-900"
      >
        {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        {!collapsed && <span>접기</span>}
      </button>
    </aside>
  );
}
