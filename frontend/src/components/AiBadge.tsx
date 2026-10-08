import { Bot, Cog } from 'lucide-react';
import { AiMeta } from '@/lib/ai-types';

/**
 * AI 결과가 "실제 AI 호출"인지 "규칙 기반 대체"인지 항상 눈에 보이게 하는 배지.
 * 규칙 기반인데 AI인 척하지 않는 것이 이 배지의 목적이다.
 */
export function AiBadge({ meta }: { meta: AiMeta | null | undefined }) {
  if (!meta) return null;
  if (meta.source === 'AI') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-tint-clay px-2 py-0.5 text-[11px] font-semibold text-brand-clay">
        <Bot size={12} /> AI 실제 호출{meta.model ? ` · ${meta.model}` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-tint-gold px-2 py-0.5 text-[11px] font-semibold text-brand-gold">
      <Cog size={12} /> 규칙 기반{meta.fallbackReason ? ` · ${meta.fallbackReason}` : ''}
    </span>
  );
}

export function AiNotice({ meta }: { meta: AiMeta | null | undefined }) {
  if (!meta) return null;
  return <p className="mt-2 text-[11px] text-ink-400">{meta.advisoryNotice}</p>;
}
