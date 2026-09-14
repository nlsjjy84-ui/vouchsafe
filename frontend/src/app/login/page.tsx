'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api, extractErrorMessage, hasErrorCode } from '@/lib/api';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // [보안 강화] 이메일 인증 전 로그인 차단(EMAIL_NOT_VERIFIED)에 걸렸을 때만
  // true - 이때는 일반 에러 문구 대신 "인증 메일 재발송" 버튼을 보여준다.
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResendMessage(null);
    setNeedsVerification(false);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push('/bounties');
    } catch (err) {
      if (hasErrorCode(err, 'EMAIL_NOT_VERIFIED')) {
        setNeedsVerification(true);
      }
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setResendMessage(null);
    try {
      const res = await api.post('/auth/resend-verification', { email });
      setResendMessage(res.data.message);
    } catch (err) {
      setResendMessage(extractErrorMessage(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-semibold">로그인</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">이메일</label>
          <input
            type="email"
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">비밀번호</label>
          <input
            type="password"
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-brand-red">{error}</p>}

        {needsVerification && (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            {resendMessage ?? (
              <>
                <p className="mb-2">아직 이메일 인증을 안 하셨다면 링크를 다시 보내드릴 수 있어요.</p>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || !email}
                  className="rounded border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                >
                  {resending ? '발송 중...' : '인증 메일 재발송'}
                </button>
              </>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-brand-teal py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? '처리중...' : '로그인'}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>
          계정이 없다면{' '}
          <Link href="/register" className="text-brand-teal underline">
            회원가입
          </Link>
        </span>
        <Link href="/forgot-password" className="text-slate-400 underline">
          비밀번호를 잊으셨나요?
        </Link>
      </div>
    </div>
  );
}
