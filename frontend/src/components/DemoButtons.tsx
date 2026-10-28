'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

/**
 * 데모 둘러보기 버튼 — 면접관·처음 온 사람이 가입 없이 로그인 후 화면을 바로 볼 수 있게 한다.
 * 의뢰인: 에스크로에 대금이 잠긴 프로젝트·AI 요구사항 초안이 있는 마이페이지로,
 * 전문가: 인증 분야 프로젝트 목록·AI 등록 도우미가 있는 프로젝트 둘러보기로 보낸다.
 */
export function DemoButtons({
  tone = 'dark',
  onDone,
  stayHere = false,
  center = false,
}: {
  tone?: 'dark' | 'light';
  onDone?: () => void;
  /** 잠긴 기능 자리에서 쓸 때: 데모로 들어간 뒤 지금 보던 화면에 그대로 머물러 바로 이어서 써 보게 한다. */
  stayHere?: boolean;
  /** 가운데 정렬된 안내 카드 안에 넣을 때 문구와 버튼을 가운데로 맞춘다. */
  center?: boolean;
}) {
  const { demoLogin } = useAuth();
  const [busy, setBusy] = useState<null | 'client' | 'expert'>(null);
  const [error, setError] = useState(false);

  async function go(role: 'client' | 'expert') {
    setBusy(role);
    setError(false);
    try {
      await demoLogin(role);
      onDone?.();
      if (stayHere) {
        window.location.reload();
        return;
      }
      // 첫 화면은 로그인되면 /bounties로 보내는 효과가 있어서, 클라이언트 라우팅 대신 주소를 바로 바꾼다.
      window.location.assign(role === 'client' ? '/mypage' : '/bounties');
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }

  const base = 'rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60';
  const style =
    tone === 'dark'
      ? 'border border-brand-clay/70 bg-white/10 text-white hover:bg-white hover:text-brand-ink'
      : 'border border-brand-clay bg-tint-clay text-brand-clay hover:bg-brand-clay hover:text-white';

  return (
    <div className={center ? 'text-center' : undefined}>
      <p className={`text-xs font-medium ${tone === 'dark' ? 'text-white/70' : 'text-ink-500'}`}>
        가입 없이 바로 체험하기 — 공용 데모 계정(둘러보기 전용)
      </p>
      <div className={`mt-2 flex flex-wrap gap-2 ${center ? 'justify-center' : ''}`}>
        <button type="button" onClick={() => go('client')} disabled={busy !== null} className={`${base} ${style}`}>
          {busy === 'client' ? '들어가는 중…' : '의뢰인으로 둘러보기'}
        </button>
        <button type="button" onClick={() => go('expert')} disabled={busy !== null} className={`${base} ${style}`}>
          {busy === 'expert' ? '들어가는 중…' : '전문가로 둘러보기'}
        </button>
      </div>
      {error && (
        <p role="alert" className={`mt-2 text-xs ${tone === 'dark' ? 'text-white/80' : 'text-brand-red'}`}>
          지금은 데모에 들어갈 수 없어요. 서버가 깨어나는 중일 수 있으니 30초 뒤 다시 눌러 주세요.
        </p>
      )}
    </div>
  );
}
