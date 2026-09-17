import { ApplicationStatus, APPLICATION_STATUS_LABELS, BountyStatus, BOUNTY_STATUS_LABELS, EscrowStatus } from '@/lib/types';

/**
 * 기획서 4장 "거래 상태를 한눈에 읽는 상태 배지" UI 원칙을 구현한 컴포넌트.
 * 상태를 색으로 바로 구분할 수 있게 해서, 글자를 읽지 않아도 "지금 안전한 단계인지
 * 주의가 필요한 단계인지"를 직관적으로 알 수 있게 하는 게 목적이다.
 */

const BOUNTY_STYLES: Record<BountyStatus, string> = {
  PENDING: 'bg-tint-ink text-ink-700 border-hairline-strong',
  PAYMENT_PENDING: 'bg-tint-gold text-brand-gold border-brand-gold/30',
  LOCKED: 'bg-tint-sage text-brand-sage border-brand-sage/30',
  SUBMITTED: 'bg-tint-gold text-brand-gold border-brand-gold/30',
  SETTLED: 'bg-tint-clay text-brand-clay border-brand-clay/30',
  DISPUTED: 'bg-tint-red text-brand-red border-brand-red/30',
  REFUNDED: 'bg-tint-ink text-ink-500 border-hairline-strong',
};

export function BountyStatusBadge({ status }: { status: BountyStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 text-xs font-medium ${BOUNTY_STYLES[status]}`}
    >
      {BOUNTY_STATUS_LABELS[status]}
    </span>
  );
}

const ESCROW_STYLES: Record<EscrowStatus, string> = {
  PENDING_PAYMENT: 'bg-tint-gold text-brand-gold border-brand-gold/30',
  LOCKED: 'bg-tint-sage text-brand-sage border-brand-sage/30',
  FROZEN: 'bg-tint-red text-brand-red border-brand-red/30',
  SETTLED: 'bg-tint-clay text-brand-clay border-brand-clay/30',
  REFUNDED: 'bg-tint-ink text-ink-700 border-hairline-strong',
};

const ESCROW_LABELS: Record<EscrowStatus, string> = {
  PENDING_PAYMENT: '결제 대기중',
  LOCKED: '자금 잠금',
  FROZEN: '자금 동결',
  SETTLED: '정산 완료',
  REFUNDED: '환불 완료',
};

export function EscrowStatusBadge({ status }: { status: EscrowStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 text-xs font-medium ${ESCROW_STYLES[status]}`}
    >
      {ESCROW_LABELS[status]}
    </span>
  );
}

// [Task #31 마이페이지] "내가 지원한 바운티" 목록에서 지원 결과를 한눈에 보여주기 위해 추가.
const APPLICATION_STYLES: Record<ApplicationStatus, string> = {
  APPLIED: 'bg-tint-ink text-ink-700 border-hairline-strong',
  SELECTED: 'bg-tint-clay text-brand-clay border-brand-clay/30',
  REJECTED: 'bg-tint-ink text-ink-500 border-hairline-strong',
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 text-xs font-medium ${APPLICATION_STYLES[status]}`}
    >
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  );
}
