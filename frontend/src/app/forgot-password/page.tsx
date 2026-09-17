'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import {
  AuthCard,
  AuthField,
  AUTH_INPUT_CLASS,
  AuthSubmitButton,
  AuthErrorText,
  AuthSuccessBox,
} from '@/components/AuthCard';

/**
 * 비밀번호 재설정 "요청" 화면.
 * 이메일을 입력해서 보내면, 실제로 가입된 이메일이든 아니든 항상 같은 성공
 * 메시지가 뜬다 — 백엔드가 이메일 존재 여부를 노출하지 않도록 설계했기 때문
 * (auth.service.ts의 requestPasswordReset 주석 참고). 그래서 이 화면도
 * "성공/실패"가 아니라 "요청이 접수됐다"는 사실만 보여준다.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="비밀번호 재설정"
      subtitle="가입할 때 쓴 이메일을 입력하면 재설정 링크를 보내드려요"
      footer={
        <Link href="/login" className="font-medium text-brand-teal hover:underline">
          로그인으로 돌아가기
        </Link>
      }
    >
      {sent ? (
        <AuthSuccessBox>
          가입된 이메일이라면 비밀번호 재설정 메일이 발송되었습니다. 메일함을 확인해주세요.
          {/* 개발 단계라 실제 메일 발송 대신 백엔드 콘솔 로그에 링크가 남는다 (Mock) */}
        </AuthSuccessBox>
      ) : (
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

          {error && <AuthErrorText>{error}</AuthErrorText>}

          <AuthSubmitButton disabled={submitting}>
            {submitting ? '처리중...' : '재설정 링크 보내기'}
          </AuthSubmitButton>
        </form>
      )}
    </AuthCard>
  );
}
