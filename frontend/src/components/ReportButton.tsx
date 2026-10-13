'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';

const REASONS: { key: string; label: string }[] = [
  { key: 'OFF_PLATFORM', label: '연락처·직거래 유도' },
  { key: 'MISLEADING', label: '사실과 다른 내용·자격' },
  { key: 'ABUSE', label: '욕설·도배' },
  { key: 'OTHER', label: '기타' },
];

/**
 * 상품·문의 신고. 자동 규칙이 놓친 것을 사람이 잡는 마지막 장치다.
 * 같은 사람은 같은 대상을 한 번만 신고할 수 있고, 관리자 화면(/admin/reports)에서 처리한다.
 */
export function ReportButton({ offerId, messageId, small }: { offerId: string; messageId?: string; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('OFF_PLATFORM');
  const [detail, setDetail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    setState('busy');
    setErr(null);
    try {
      await api.post(`/offers/${offerId}/report`, { reason, detail: detail.trim() || undefined, messageId });
      setState('done');
    } catch (e) {
      setErr(extractErrorMessage(e));
      setState('idle');
    }
  }

  if (state === 'done') return <span className="text-[11px] text-ink-400">신고했어요. 관리자가 확인해요.</span>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`inline-flex items-center gap-1 text-ink-400 hover:text-brand-red ${small ? 'text-[11px]' : 'text-xs'}`}>
        <Flag size={small ? 11 : 13} /> 신고
      </button>
    );
  }
  return (
    <div className="mt-2 w-full space-y-2 rounded-2xl border border-hairline bg-surface-canvas p-3 text-xs">
      <div className="flex flex-wrap gap-1.5">
        {REASONS.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setReason(r.key)}
            className={`rounded-full px-2.5 py-1 ${reason === r.key ? 'bg-brand-red text-white' : 'bg-surface-raised text-ink-700'}`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <input
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        maxLength={300}
        placeholder="자세한 내용 (선택)"
        className="w-full rounded-xl border border-hairline bg-surface px-3 py-2 outline-none focus:border-brand-red"
      />
      {err && <p className="text-brand-red">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1.5 text-ink-500 hover:bg-surface-raised">취소</button>
        <button type="button" disabled={state === 'busy'} onClick={send} className="rounded-full bg-brand-red px-3 py-1.5 font-semibold text-white disabled:opacity-50">
          신고하기
        </button>
      </div>
    </div>
  );
}
