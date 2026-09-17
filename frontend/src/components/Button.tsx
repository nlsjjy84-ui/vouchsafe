import { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * =========================================================================
 * 공용 버튼 컴포넌트 (2026-09-16 신설)
 * =========================================================================
 * 이전까지는 화면마다 "rounded-full bg-brand-teal px-4 py-2 text-sm
 * font-semibold text-white hover:opacity-90" 같은 똑같은 문자열을 버튼이
 * 나올 때마다 복사-붙여넣기하고 있었다 - 그래서 로그인/지원하기/바운티
 * 등록/정산하기가 전부 시각적으로 구분이 안 되는 "같은 버튼"처럼 보인다는
 * 피드백을 받았다("버튼이 전부 너무 단순하고 똑같아보여... 지루해").
 *
 * 원인은 두 가지였다:
 *   1) brand.teal 자체가 Tailwind 기본 팔레트 teal-500/600을 그대로 쓰고
 *      있어서 색 자체가 흔했다 → tailwind.config.ts에서 커스텀 조색으로 교체.
 *   2) 색은 5가지(teal/blue/amber/navy/red)나 정의돼 있었는데 버튼은 거의
 *      다 teal 하나만 썼다 → 이 컴포넌트가 "역할(variant) × 톤(tone)"을
 *      명시적으로 고르게 강제해서, 화면 안에서 정말 하나만 있어야 할
 *      "핵심 액션"만 solid teal을 쓰고, 나머지(선택/승인/보조/위험)는
 *      다른 조합을 쓰도록 각 페이지에서 의도적으로 고르게 했다.
 *
 * variant:
 *   - solid   : 배경 꽉 채움. 화면당 정말 "지금 눌러야 하는 것" 한둘에만.
 *   - outline : 테두리만, hover 시 반전. 보조/위험 액션.
 *   - soft    : 옅은 tint 배경 + 진한 텍스트. 존재감은 있지만 solid보다
 *               한 단계 낮은 우선순위(선택/유틸리티성 액션)에 쓴다.
 *   - text    : 배경/테두리 없이 텍스트만. 링크에 가까운 보조 동작.
 *
 * 모양(shape)도 색만큼 "다 똑같아 보인다"는 지적의 원인이었다 - 전 버튼이
 * 예외 없이 완전한 알약(rounded-full) + 같은 그림자였다. 그래서 "화면당 단
 * 하나의 핵심 액션"(tone=teal, variant=solid)만 완전한 알약 + 그림자(눌러야
 * 할 것 같은 무게감)를 유지하고, 나머지는 전부 살짝 각진 rounded-xl + 그림자
 * 없이 평평하게 둬서 실루엣 자체가 다르게 보이도록 했다.
 * =========================================================================
 */

export type ButtonTone = 'teal' | 'blue' | 'amber' | 'navy' | 'red';
export type ButtonVariant = 'solid' | 'outline' | 'soft' | 'text';
export type ButtonSize = 'sm' | 'md' | 'lg';

const TONE_HEX: Record<ButtonTone, { solidBg: string; solidHover: string; text: string; border: string; softBg: string }> = {
  teal: { solidBg: 'bg-brand-teal', solidHover: 'hover:bg-brand-tealDeep', text: 'text-brand-teal', border: 'border-brand-teal', softBg: 'bg-tint-teal' },
  blue: { solidBg: 'bg-brand-blue', solidHover: 'hover:brightness-90', text: 'text-brand-blue', border: 'border-brand-blue', softBg: 'bg-tint-blue' },
  amber: { solidBg: 'bg-brand-amber', solidHover: 'hover:brightness-90', text: 'text-brand-amber', border: 'border-brand-amber', softBg: 'bg-tint-amber' },
  navy: { solidBg: 'bg-brand-navy', solidHover: 'hover:bg-brand-navyLight', text: 'text-brand-navy', border: 'border-brand-navy', softBg: 'bg-tint-navy' },
  red: { solidBg: 'bg-brand-red', solidHover: 'hover:brightness-90', text: 'text-brand-red', border: 'border-brand-red', softBg: 'bg-tint-red' },
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'w-full py-2.5 text-sm',
};

/** 화면당 단 하나여야 하는 "진짜 핵심 액션"만 완전한 알약 모양을 쓴다. */
function isPrimaryCta(variant: ButtonVariant, tone: ButtonTone) {
  return variant === 'solid' && tone === 'teal';
}

function shapeClass(variant: ButtonVariant, tone: ButtonTone) {
  return isPrimaryCta(variant, tone) ? 'rounded-full' : 'rounded-xl';
}

function variantClass(variant: ButtonVariant, tone: ButtonTone) {
  const t = TONE_HEX[tone];
  const primary = isPrimaryCta(variant, tone);
  switch (variant) {
    case 'solid':
      return `${t.solidBg} text-white transition-colors ${t.solidHover} ${
        primary
          ? 'shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
          : ''
      }`;
    case 'outline':
      return `border bg-transparent ${t.border} ${t.text} transition-colors hover:text-white ${
        tone === 'teal'
          ? 'hover:bg-brand-teal'
          : tone === 'blue'
            ? 'hover:bg-brand-blue'
            : tone === 'amber'
              ? 'hover:bg-brand-amber'
              : tone === 'navy'
                ? 'hover:bg-brand-navy'
                : 'hover:bg-brand-red'
      }`;
    case 'soft':
      return `${t.softBg} ${t.text} transition-colors hover:brightness-95`;
    case 'text':
      return `bg-transparent ${t.text} underline-offset-4 hover:underline`;
  }
}

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  children: ReactNode;
  tone?: ButtonTone;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  children,
  tone = 'teal',
  variant = 'solid',
  size = 'md',
  icon,
  fullWidth,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 font-semibold disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none ${
        fullWidth ? 'w-full' : ''
      } ${shapeClass(variant, tone)} ${SIZE_CLASS[size]} ${variantClass(variant, tone)}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
