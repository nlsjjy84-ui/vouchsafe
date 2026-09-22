import Link from 'next/link';
import { ReactNode } from 'react';
import { Button } from './Button';
import { JangdanMark } from './JangdanMark';

/**
 * 로그인/회원가입/비밀번호 재설정/이메일 인증 화면이 공통으로 쓰는 카드 레이아웃.
 * 화면마다 폼 내용만 다르고 "가운데 정렬된 카드 + 로고 + 제목" 뼈대는 똑같아서
 * 여기로 뽑아뒀다 - 디자인을 한 곳만 고치면 5개 화면에 다 반영된다.
 */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center py-10">
      <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-ink">
          <JangdanMark size={18} variant="dark" />
        </span>
        <span className="font-display text-xl tracking-wide text-ink-900">Vouchsafe</span>
      </Link>

      <div className="rounded-4xl border border-hairline bg-surface-canvas p-8 shadow-bloom">
        <h1 className="font-display text-2xl tracking-wide text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>

      {footer && <div className="mt-5 text-center text-sm text-ink-500">{footer}</div>}
    </div>
  );
}

/** 라벨 + input을 한 세트로 묶는 필드. 모든 인증 화면 폼이 공통으로 쓴다. */
export function AuthField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink-700">
        {label} {hint && <span className="font-normal text-ink-400">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

export const AUTH_INPUT_CLASS =
  'w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-clay focus:ring-2 focus:ring-brand-clay/20';

export function AuthSubmitButton({
  children,
  disabled,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button type="submit" disabled={disabled} size="lg" tone="teal" variant="solid">
      {children}
    </Button>
  );
}

export function AuthErrorText({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-tint-red px-3 py-2 text-sm text-brand-red">{children}</p>;
}

export function AuthSuccessBox({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-tint-clay px-4 py-3 text-sm text-brand-clay">{children}</div>;
}
