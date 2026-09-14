'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { extractErrorMessage } from '@/lib/api';
import { User } from '@/lib/types';

export default function RegisterPage() {
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState<User['role']>('CLIENT');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // [보안 강화] 가입 직후 자동 로그인이 사라지면서, 성공 시 바로 다른 화면으로
  // 이동하는 대신 "메일함을 확인해주세요" 안내로 바꿨다 (forgot-password 페이지와
  // 같은 패턴). 서버가 돌려준 메시지를 그대로 보여준다.
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await register(email, password, name, role, phoneNumber || undefined);
      setSuccessMessage(result.message);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (successMessage) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-2xl font-semibold">회원가입</h1>
        <div className="rounded border border-teal-200 bg-teal-50 p-4 text-sm text-brand-teal">
          {successMessage}
          {/* 개발 단계라 실제 메일 발송 대신 백엔드 콘솔 로그에 링크가 남는다 (Mock) */}
        </div>
        <p className="mt-4 text-sm text-slate-500">
          <Link href="/login" className="text-brand-teal underline">
            로그인하러 가기
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-semibold">회원가입</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">이름</label>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

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
          <label className="mb-1 block text-sm font-medium">
            휴대폰 번호 <span className="font-normal text-slate-400">(선택 · 안심번호 기능에 필요해요)</span>
          </label>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2"
            placeholder="010-1234-5678"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
        </div>

        <div>
          {/* [보안 강화] 8자 이상 → 16자 이상 + 대/소문자 + 특수문자 조합 필수로
              강화 (backend/.../password-policy.ts와 동일한 규칙). pattern 속성으로
              제출 전에 브라우저가 먼저 걸러주고, 그래도 통과 못 하면 서버가
              최종적으로 같은 규칙을 한 번 더 검사한다. */}
          <label className="mb-1 block text-sm font-medium">
            비밀번호 <span className="font-normal text-slate-400">(16자 이상 · 대문자·소문자·특수문자 포함)</span>
          </label>
          <input
            type="password"
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={16}
            pattern="(?=.*[A-Z])(?=.*[a-z])(?=.*[^A-Za-z0-9]).{16,}"
            title="16자 이상이며 대문자, 소문자, 특수문자를 각각 최소 1개 이상 포함해야 합니다"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">역할</label>
          <div className="flex gap-2">
            {(['CLIENT', 'EXPERT', 'HYBRID'] as const).map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setRole(r)}
                className={`flex-1 rounded border px-3 py-2 text-sm ${
                  role === r
                    ? 'border-brand-teal bg-teal-50 font-medium text-brand-teal'
                    : 'border-slate-300 text-slate-600'
                }`}
              >
                {r === 'CLIENT' ? '의뢰인' : r === 'EXPERT' ? '전문가' : '둘 다'}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-brand-red">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-brand-teal py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? '처리중...' : '가입하기'}
        </button>
      </form>
    </div>
  );
}
