'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { AppNotification } from '@/lib/types';

/**
 * Task #30 "인앱 알림 로그" 프론트엔드.
 *
 * 실시간 푸시(웹소켓)가 아니라 30초마다 "안 읽은 개수"만 가볍게 폴링하는
 * 방식이다 - 이 프로젝트 규모에서는 웹소켓 인프라를 새로 두는 것보다 훨씬
 * 간단하면서도 체감 지연은 크지 않다. 벨을 클릭했을 때만 실제 목록을 불러온다
 * (평소에는 개수만 확인하느라 매번 전체 목록을 내려받지 않도록).
 */
export function NotificationBell() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get<{ count: number }>('/notifications/me/unread-count');
      setUnreadCount(res.data.count);
    } catch {
      // 알림 개수 조회 실패는 화면 전체를 막을 이유가 없어 조용히 무시한다.
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        const res = await api.get<AppNotification[]>('/notifications/me');
        setNotifications(res.data);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleClickNotification = async (n: AppNotification) => {
    if (!n.isRead) {
      try {
        await api.patch(`/notifications/${n.id}/read`);
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // 읽음 처리 실패해도 이동 자체는 막지 않는다.
      }
    }
    setOpen(false);
    if (n.relatedBountyId) {
      router.push(`/bounties/${n.relatedBountyId}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((x) => ({ ...x, isRead: true })));
      setUnreadCount(0);
    } catch {
      // no-op
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={toggleOpen}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-slate-200 hover:bg-white/10 hover:text-white"
        aria-label="알림"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-slate-200 bg-white text-slate-800 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-sm font-semibold">알림</span>
            {notifications.some((n) => !n.isRead) && (
              <button onClick={handleMarkAllRead} className="text-xs text-brand-blue hover:underline">
                모두 읽음 처리
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && <p className="px-3 py-6 text-center text-sm text-slate-400">불러오는 중...</p>}
            {!loading && notifications.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-400">아직 알림이 없어요</p>
            )}
            {!loading &&
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={`block w-full border-b border-slate-50 px-3 py-2.5 text-left text-sm hover:bg-slate-50 ${
                    n.isRead ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-teal" />}
                    <div className={n.isRead ? 'pl-3.5' : ''}>
                      <p className="font-medium text-slate-900">{n.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{n.message}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {new Date(n.createdAt).toLocaleString('ko-KR')}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
