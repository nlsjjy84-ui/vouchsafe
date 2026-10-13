import { Info } from 'lucide-react';

/**
 * 상품 올리기 안내. 1인 1계정이라 부계정으로 상품 자리를 늘릴 수 없고, 열어 둘 수 있는 상품이 5개뿐이라
 * 전문가가 "가장 자신 있는 일부터 골라 올리게" 미리 알려 준다.
 */
export function OfferGuide({ compact = false }: { compact?: boolean }) {
  const items = [
    '계정은 한 사람에 하나예요. 부계정을 만들 수 없어서 상품 자리를 늘릴 방법이 없어요.',
    '열어 둘 수 있는 상품은 5개예요. 가장 자신 있고 자주 하는 일부터 골라 올려 주세요.',
    '분야는 올린 뒤에 바꿀 수 없어요. 가격·설명·사진은 언제든 고칠 수 있어요.',
    '안 쓰는 상품은 마감하면 자리가 하나 비어요. 마감한 상품은 나중에 다시 열 수 있어요.',
    '연락처나 직거래 이야기는 한글·띄어쓰기로 바꿔 써도 막혀요. 연락은 의뢰 뒤 안심번호로 해요.',
  ];
  return (
    <section aria-label="상품 올리기 안내" className="rounded-3xl border border-brand-gold/40 bg-tint-gold px-5 py-4">
      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900">
        <Info size={15} className="text-brand-gold" /> 올리기 전에 꼭 읽어 주세요
      </p>
      <ul className={`mt-2 list-disc space-y-1 pl-5 text-ink-700 ${compact ? 'text-xs' : 'text-sm'}`}>
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  );
}
