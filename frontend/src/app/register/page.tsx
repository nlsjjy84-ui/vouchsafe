'use client';

import { useState } from 'react';
import Link from 'next/link';
import { User as UserIcon, Mail, Lock, Phone, Briefcase, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { extractErrorMessage } from '@/lib/api';
import { User } from '@/lib/types';
import {
  AuthCard,
  AuthField,
  AUTH_INPUT_CLASS,
  AuthSubmitButton,
  AuthErrorText,
} from '@/components/AuthCard';
import { SuccessPulse } from '@/components/SuccessPulse';

const ROLE_OPTIONS: Array<{ value: User['role']; label: string; icon: typeof UserIcon }> = [
  { value: 'CLIENT', label: '의뢰인', icon: Briefcase },
  { value: 'EXPERT', label: '전문가', icon: UserIcon },
  { value: 'HYBRID', label: '둘 다', icon: Users },
];

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
      <AuthCard title="회원가입">
        <SuccessPulse>
          {successMessage}
          {/* 개발 단계라 실제 메일 발송 대신 백엔드 콘솔 로그에 링크가 남는다 (Mock) */}
        </SuccessPulse>
        <p className="mt-4 text-sm text-ink-500">
          <Link href="/login" className="font-medium text-brand-teal hover:underline">
            로그인하러 가기
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="회원가입"
      subtitle="의뢰인으로 시작하든 전문가로 시작하든, 언제든 둘 다 될 수 있어요"
      footer={
        <span>
          이미 계정이 있다면{' '}
          <Link href="/login" className="font-medium text-brand-teal hover:underline">
            로그인
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField label="이름">
          <div className="relative">
            <UserIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className={`${AUTH_INPUT_CLASS} pl-9`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        </AuthField>

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

        <AuthField label="휴대폰 번호" hint="(선택 · 안심번호 기능에 필요해요)">
          <div className="relative">
            <Phone size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className={`${AUTH_INPUT_CLASS} pl-9`}
              placeholder="010-1234-5678"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>
        </AuthField>

        {/* [보안 강화] 10자 이상 + 대/소문자 + 숫자 + 특수문자 조합 필수
            (backend/.../strong-password.decorator.ts와 동일한 규칙). pattern 속성으로
            제출 전에 브라우저가 먼저 걸러주고, 그래도 통과 못 하면 서버가
            최종적으로 같은 규칙을 한 번 더 검사한다. */}
        <AuthField label="비밀번호" hint="(10자 이상 · 대문자·소문자·숫자·특수문자 포함)">
          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="password"
              className={`${AUTH_INPUT_CLASS} pl-9`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={10}
              pattern="(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{10,}"
              title="10자 이상이며 대문자, 소문자, 숫자, 특수문자를 각각 최소 1개 이상 포함해야 합니다"
              required
            />
          </div>
        </AuthField>

        <AuthField label="역할">
          <div className="grid grid-cols-3 gap-2">
            {ROLE_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                type="button"
                key={value}
                onClick={() => setRole(value)}
                className={`flex flex-col items-center gap-1 rounded-2xl border px-3 py-2.5 text-xs font-medium transition-colors ${
                  role === value
                    ? 'border-brand-teal bg-tint-teal text-brand-teal'
                    : 'border-hairline text-ink-500 hover:border-hairline-strong'
                }`}
              >
                <Icon size={16} strokeWidth={1.75} />
                {label}
              </button>
            ))}
          </div>
        </AuthField>

        {error && <AuthErrorText>{error}</AuthErrorText>}

        <AuthSubmitButton disabled={submitting}>{submitting ? '처리중...' : '가입하기'}</AuthSubmitButton>
      </form>
    </AuthCard>
  );
}
