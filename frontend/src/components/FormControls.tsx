import { ReactNode } from 'react';
import { Button, ButtonTone } from './Button';

/**
 * 인증 화면 전용이 아닌 "일반 폼"(바운티 등록, 자격 인증 신청 등)에서 공통으로 쓰는
 * 입력 스타일 - AuthCard.tsx의 AUTH_INPUT_CLASS와 톤을 맞추되, 이 파일은 카드
 * 래퍼 없이 필드 스타일만 제공한다.
 */
export const FIELD_INPUT_CLASS =
  'w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-clay focus:ring-2 focus:ring-brand-clay/20';

export function FormField({
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

export function FormSubmitButton({
  children,
  disabled,
  tone = 'teal',
}: {
  children: ReactNode;
  disabled?: boolean;
  tone?: ButtonTone;
}) {
  return (
    <Button type="submit" disabled={disabled} size="lg" tone={tone} variant="solid">
      {children}
    </Button>
  );
}

/**
 * 보조 액션용 "고스트 필" 버튼 - 기본은 테두리만 있다가 hover에서 색이 반전되며
 * 채워진다("색상의 반전" 피드백 반영). 관리자 중재/이의제기 같은 위험도 낮은
 * 보조 동작에 쓴다. 내부적으로는 Button(variant="outline")을 그대로 위임한다 -
 * 이름은 기존 호출부 호환을 위해 남겨뒀다.
 */
export function GhostPillButton({
  children,
  onClick,
  disabled,
  tone = 'teal',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: ButtonTone;
}) {
  return (
    <Button type="button" onClick={onClick} disabled={disabled} size="sm" tone={tone} variant="outline">
      {children}
    </Button>
  );
}

export function FormErrorText({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-tint-red px-3 py-2 text-sm text-brand-red">{children}</p>;
}
