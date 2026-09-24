'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { AuthCard } from '@/components/AuthCard';

type Status = 'checking' | 'success' | 'error';

/** 이메일 인증 링크(/verify-email?token=...)를 클릭하면 들어오는 화면. 들어오자마자 자동으로 인증을 시도한다. */
function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState('');
  // React 18 StrictMode(개발 모드)에서 useEffect가 두 번 실행되는 것 때문에
  // 토큰이 "먼저 한 번 써버려서" 두 번째 호출이 실패로 보이는 걸 막기 위한 가드.
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!token || requestedRef.current) {
      if (!token) {
        setStatus('error');
        setMessage('링크에 인증 토큰이 없어요.');
      }
      return;
    }
    requestedRef.current = true;

    api
      .post('/auth/verify-email/confirm', { token })
      .then(() => {
        setStatus('success');
        setMessage('이메일 인증이 완료되었습니다.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(extractErrorMessage(err));
      });
  }, [token]);

  if (status === 'checking') {
    return <p className="text-sm text-ink-500">인증 확인 중...</p>;
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
        status === 'success' ? 'bg-tint-clay text-brand-clay' : 'bg-tint-red text-brand-red'
      }`}
    >
      {status === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
      {message}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthCard
      title="이메일 인증"
      footer={
        // [보안 강화] 이메일 인증 전 로그인 차단이 생기면서, 인증 직후 자동 로그인
        // 상태가 아니게 됐다 - 이제 인증을 마쳐도 로그인은 따로 해야 하므로,
        // "프로젝트 목록으로"(로그인이 필요한 화면) 대신 로그인 화면으로 안내한다.
        <Link href="/login" className="font-medium text-brand-clay hover:underline">
          로그인하러 가기
        </Link>
      }
    >
      <Suspense fallback={<p className="text-sm text-ink-500">불러오는 중...</p>}>
        <VerifyEmailInner />
      </Suspense>
    </AuthCard>
  );
}
