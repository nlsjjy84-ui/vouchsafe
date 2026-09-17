'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ChatWidget } from './ChatWidget';

/**
 * =========================================================================
 * AppShell — 로그인 여부에 따라 레이아웃을 통째로 바꿔주는 스위치.
 * =========================================================================
 * - 로그인 전 / 로딩 중: 기존 상단 Navbar + 가운데 정렬된 본문 (마케팅/랜딩 레이아웃 그대로 유지).
 * - 로그인 후: 좌측 Sidebar + 상단 Topbar + 우하단 ChatWidget(AI 챗봇)이 붙는 "앱" 레이아웃.
 *
 * Next.js 라우트 그룹으로 화면을 아예 분리하는 대신, layout.tsx 한 곳에서 useAuth()
 * 상태만 보고 조건부 렌더링하는 방식을 택했다 - 기존 페이지 파일을 옮기거나 지우지
 * 않고도 두 레이아웃을 공존시킬 수 있기 때문 (Phase 2 리모델링 원칙: 되도록 새 파일만
 * 추가해서 기존 화면이 깨질 위험을 줄인다).
 *
 * 디자인 v4 (concept-b/c 합의 반영): 로그인 후 본문을 옅은 회색 캔버스(bg-surface)
 * 위에 떠 있는 rounded-4xl 흰 패널로 감쌌다 - concept-c에서 채택한 "원형·블롭" 형태
 * 언어(둥근 모서리 + 은은한 그림자로 떠 있는 느낌)를 페이지마다 따로 손대지 않고도
 * 인증 화면 전체에 한 번에 적용하기 위함이다. 개별 페이지 파일은 그대로 두고
 * 이 패널 안에서만 렌더링된다.
 * =========================================================================
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem('credobounty_sidebar_collapsed') === '1');
    } catch {
      // 접힘 상태 기억 실패는 무시 - 기본값(펼침)으로 계속 동작한다.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('credobounty_sidebar_collapsed', next ? '1' : '0');
      } catch {
        // 저장 실패는 무시.
      }
      return next;
    });
  }

  if (loading || !user) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      <div className={collapsed ? 'pl-16' : 'pl-64'} style={{ transition: 'padding-left 200ms' }}>
        <Topbar />
        <main className="mx-auto max-w-6xl px-6 py-6">
          <div className="rounded-4xl bg-surface-canvas p-6 shadow-sm ring-1 ring-hairline sm:p-8">{children}</div>
        </main>
      </div>
      <ChatWidget />
    </div>
  );
}
