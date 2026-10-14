'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';

type Balance = { earned: number; paid: number; pending: number; available: number; minimum: number };
type Row = {
  id: string;
  amount: number;
  status: 'REQUESTED' | 'PAID' | 'REJECTED';
  account: string;
  transferRef: string | null;
  rejectReason: string | null;
  requestedAt: string;
  decidedAt: string | null;
};

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const day = (s: string) => new Date(s).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
const STATUS: Record<Row['status'], { label: string; cls: string }> = {
  REQUESTED: { label: '처리 대기', cls: 'bg-tint-gold text-brand-gold' },
  PAID: { label: '보냄(모의)', cls: 'bg-tint-sage text-brand-sage' },
  REJECTED: { label: '반려', cls: 'bg-tint-red text-brand-red' },
};

/**
 * 정산금 출금 — 정산 계좌로 받을 돈을 신청한다(모의 송금: 실제 이체는 일어나지 않는다).
 * 출금 가능 = 정산받은 금액(수수료 뺀 몫) − 이미 보낸 금액 − 처리 대기 금액.
 * 처리 대기 신청은 하나만 둘 수 있고, 관리자가 승인하면 모의 이체 번호가 붙는다.
 */
export function PayoutWithdrawCard() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/payout-requests/me').then((r) => {
      setBalance(r.data.balance);
      setRows(r.data.requests);
    }).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const open = rows.some((r) => r.status === 'REQUESTED');
  const canAsk = !!balance && !open && balance.available >= balance.minimum;

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const n = Number(amount.replace(/[^0-9]/g, ''));
      await api.post('/payout-requests', n ? { amount: n } : {});
      setAmount('');
      load();
    } catch (err) {
      setMsg(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!balance) return null;
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-ink-900">정산금 출금 <span className="text-ink-400">(모의 송금)</span></h2>
      <div className="space-y-4 rounded-4xl border border-hairline bg-surface-canvas p-4">
        <div className="flex items-center gap-3">
          <Wallet className="h-5 w-5 flex-shrink-0 text-brand-clay" />
          <div className="min-w-0">
            <p className="text-sm text-ink-500">출금 가능</p>
            <p className="font-display text-2xl tabular-nums text-ink-900">{won(balance.available)}</p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center text-xs">
          {[
            ['정산받음(수수료 제외)', balance.earned],
            ['보냄', balance.paid],
            ['처리 대기', balance.pending],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-2xl bg-surface-raised px-2 py-2">
              <dt className="text-ink-500">{k}</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-ink-900">{won(v as number)}</dd>
            </div>
          ))}
        </dl>
        <form onSubmit={ask} className="flex flex-wrap items-center gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
            placeholder={`금액(비우면 ${won(balance.available)} 전부)`}
            disabled={!canAsk || busy}
            className="min-w-0 flex-1 rounded-2xl border border-hairline bg-surface-canvas px-3 py-2 text-sm disabled:opacity-50"
          />
          <button type="submit" disabled={!canAsk || busy} className="rounded-full bg-brand-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
            {busy ? '신청하는 중…' : '출금 신청'}
          </button>
        </form>
        <p className="text-xs text-ink-500">
          {open
            ? '처리 중인 신청이 있어요. 끝나면 다시 신청할 수 있어요.'
            : balance.available < balance.minimum
              ? `${won(balance.minimum)}부터 출금할 수 있어요.`
              : '관리자가 확인한 뒤 등록한 정산 계좌로 보내요. 지금은 모의 송금이라 실제 돈은 움직이지 않아요.'}
        </p>
        {msg && <p className="text-sm text-brand-red" role="status">{msg}</p>}
        {rows.length > 0 && (
          <ul className="divide-y divide-hairline text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="tabular-nums text-ink-900">{day(r.requestedAt)} · {won(r.amount)}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                  {r.transferRef && <code>{r.transferRef}</code>}
                  {r.rejectReason && <span>사유: {r.rejectReason}</span>}
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
