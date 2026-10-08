import Link from 'next/link';
import { BadgeCheck, Megaphone, MessageCircleQuestion, ShieldAlert, Lightbulb, Star } from 'lucide-react';
import { DOMAIN_LABELS } from '@/lib/types';
import { CATEGORY_LABELS, CommunityAuthor, PostCategory } from '@/lib/community-types';
import { AvatarModule } from './AvatarModule';

const CATEGORY_STYLE: Record<PostCategory, { cls: string; icon: React.ReactNode }> = {
  REVIEW: { cls: 'bg-tint-sage text-brand-sage', icon: <Star size={12} /> },
  QUESTION: { cls: 'bg-tint-ink text-brand-ink', icon: <MessageCircleQuestion size={12} /> },
  WARNING: { cls: 'bg-tint-red text-brand-red', icon: <ShieldAlert size={12} /> },
  TIP: { cls: 'bg-tint-gold text-brand-gold', icon: <Lightbulb size={12} /> },
  NOTICE: { cls: 'bg-brand-ink text-white', icon: <Megaphone size={12} /> },
};

export function CategoryBadge({ category }: { category: PostCategory }) {
  const s = CATEGORY_STYLE[category];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${s.cls}`}>
      {s.icon} {CATEGORY_LABELS[category]}
    </span>
  );
}

/**
 * 작성자 표시. 익명 없이 항상 이름이 보이고, 승인된 전문가이면 인증 분야를 함께 보여준다.
 * (이 분야 인증은 '전문가 인증' 메뉴에서 승인된 건만 나온다 - 작성자가 직접 고칠 수 없음)
 */
export function AuthorChip({ author, size = 28, linkProfile = false }: { author: CommunityAuthor; size?: number; linkProfile?: boolean }) {
  const isExpert = author.role === 'EXPERT' || author.role === 'HYBRID';
  const nameEl = <span className="text-sm font-semibold text-ink-900">{author.name}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="inline-flex items-center gap-1.5">
        <AvatarModule name={author.name} role={author.role} size={size} />
        {linkProfile && isExpert ? (
          <Link href={`/experts/${author.id}`} className="hover:underline">{nameEl}</Link>
        ) : (
          nameEl
        )}
      </span>
      {author.role === 'ADMIN' && (
        <span className="rounded-full bg-brand-ink px-2 py-0.5 text-[10px] font-bold text-white">운영자</span>
      )}
      {author.verifiedDomains.slice(0, 2).map((d) => (
        <span key={d} className="inline-flex items-center gap-0.5 rounded-full bg-tint-clay px-2 py-0.5 text-[10px] font-bold text-brand-clay">
          <BadgeCheck size={11} /> {DOMAIN_LABELS[d]} 인증
        </span>
      ))}
      {author.verifiedDomains.length > 2 && (
        <span className="text-[10px] text-ink-400">+{author.verifiedDomains.length - 2}</span>
      )}
    </span>
  );
}
