'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api, extractErrorMessage, hasErrorCode } from '@/lib/api';
import {
  AuthCard,
  AuthField,
  AUTH_INPUT_CLASS,
  AuthSubmitButton,
  AuthErrorText,
} from '@/components/AuthCard';

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
    <AuthCard
      title="로그인"
      subtitle="검증된 전문가와 의뢰인을 잇는 Vouchsafe에 오신 걸 환영해요"
      footer={
        <div className="flex items-center justify-between">
          <span>
            계정이 없다면{' '}
            <Link href="/register" className="font-medium text-brand-clay hover:underline">
              회원가입
            </Link>
          </span>
          <Link href="/forgot-password" className="text-ink-400 hover:underline">
            비밀번호를 잊으셨나요?
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField label="이메일">
          <div className="relative">
            <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="email"
              className={`${AUTH_INPUT_CLASS} pl-9`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </AuthField>

        <AuthField label="비밀번호">
          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="password"
              className={`${AUTH_INPUT_CLASS} pl-9`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </AuthField>

        {error && <AuthErrorText>{error}</AuthErrorText>}

        {needsVerification && (
          <div className="rounded-2xl bg-tint-gold p-3 text-sm text-brand-gold">
            {resendMessage ?? (
              <>
                <p className="mb-2">아직 이메일 인증을 안 하셨다면 링크를 다시 보내드릴 수 있어요.</p>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || !email}
                  className="rounded-full border border-brand-gold/40 bg-surface-canvas px-3 py-1.5 text-sm font-medium text-brand-gold hover:bg-surface-canvas/70 disabled:opacity-50"
                >
                  {resending ? '발송 중...' : '인증 메일 재발송'}
                </button>
              </>
            )}
          </div>
        )}

        <AuthSubmitButton disabled={submitting}>{submitting ? '처리중...' : '로그인'}</AuthSubmitButton>
      </form>
    </AuthCard>
  );
}
