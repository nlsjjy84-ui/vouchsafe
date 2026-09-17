'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import {
  AuthCard,
  AuthField,
  AUTH_INPUT_CLASS,
  AuthSubmitButton,
  AuthErrorText,
} from '@/components/AuthCard';
import { SuccessPulse } from '@/components/SuccessPulse';

/**
 * 비밀번호 재설정 "실행" 화면. 이메일에 담긴 링크
 * (/reset-password?token=...)를 클릭하면 여기로 들어온다.
 *
 * useSearchParams()로 URL의 ?token=... 값을 읽는 컴포넌트는 Next.js App Router
 * 규칙상 <Suspense> 경계로 감싸야 빌드 시 에러가 안 난다. 그래서 실제 내용은
 * ResetPasswordForm에 두고, 바깥의 default export가 Suspense로 감싸는 구조로 나눴다.
 */
function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError('유효하지 않은 링크입니다. 재설정을 다시 요청해주세요.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setDone(true);
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthErrorText>
        링크에 재설정 토큰이 없어요.{' '}
        <Link href="/forgot-password" className="underline">
          다시 요청하기
        </Link>
      </AuthErrorText>
    );
  }

  if (done) {
    return <SuccessPulse>비밀번호가 변경되었습니다. 잠시 후 로그인 화면으로 이동해요.</SuccessPulse>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* [보안 강화] register 페이지와 동일한 정책 (10자 이상 +
          대/소문자 + 숫자 + 특수문자 조합 필수) - backend strong-password.decorator.ts 참고. */}
      <AuthField label="새 비밀번호" hint="(10자 이상 · 대문자·소문자·숫자·특수문자 포함)">
        <div className="relative">
          <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="password"
            className={`${AUTH_INPUT_CLASS} pl-9`}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={10}
            pattern="(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{10,}"
            title="10자 이상이며 대문자, 소문자, 숫자, 특수문자를 각각 최소 1개 이상 포함해야 합니다"
            required
          />
        </div>
      </AuthField>

      {error && <AuthErrorText>{error}</AuthErrorText>}

      <AuthSubmitButton disabled={submitting}>{submitting ? '처리중...' : '비밀번호 변경'}</AuthSubmitButton>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthCard title="새 비밀번호 설정">
      <Suspense fallback={<p className="text-sm text-ink-500">불러오는 중...</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
