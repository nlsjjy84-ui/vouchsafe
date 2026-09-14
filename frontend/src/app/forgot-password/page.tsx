'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, extractErrorMessage } from '@/lib/api';

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
    <div className="mx-auto max-w-md">
      <h1 className="mb-2 text-2xl font-semibold">비밀번호 재설정</h1>
      <p className="mb-6 text-sm text-slate-500">
        가입할 때 쓴 이메일을 입력하면 재설정 링크를 보내드려요.
      </p>

      {sent ? (
        <div className="rounded border border-teal-200 bg-teal-50 p-4 text-sm text-brand-teal">
          가입된 이메일이라면 비밀번호 재설정 메일이 발송되었습니다. 메일함을 확인해주세요.
          {/* 개발 단계라 실제 메일 발송 대신 백엔드 콘솔 로그에 링크가 남는다 (Mock) */}
        </div>
      ) : (
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

          {error && <p className="text-sm text-brand-red">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-brand-teal py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? '처리중...' : '재설정 링크 보내기'}
          </button>
        </form>
      )}

      <p className="mt-4 text-sm text-slate-500">
        <Link href="/login" className="text-brand-teal underline">
          로그인으로 돌아가기
        </Link>
      </p>
    </div>
  );
}
