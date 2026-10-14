'use client';

import { useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';

type PayoutView = { bank: string; bankCode: string; masked: string; holderName: string; verifiedAt: string } | null;

/**
 * 정산 계좌 — 1인 1계좌.
 * 예금주는 가입한 실명과 같아야 하고, 같은 계좌는 한 사람만 쓸 수 있다.
 * 다시 등록하면 기존 계좌가 바뀐다(두 개가 되지 않는다). 계좌번호는 끝 4자리만 보여 준다.
 */
export function PayoutAccountCard() {
  const [banks, setBanks] = useState<Record<string, string>>({});
  const [account, setAccount] = useState<PayoutView>(null);
  const [editing, setEditing] = useState(false);
  const [bankCode, setBankCode] = useState('');
  const [number, setNumber] = useState('');
  const [holder, setHolder] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/payout-account/me').then((r) => {
      setBanks(r.data.banks || {});
      setAccount(r.data.account);
    }).catch(() => {});
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const r = await api.put('/payout-account/me', { bankCode, accountNumber: number, holderName: holder });
      setAccount(r.data.account);
      setEditing(false);
      setNumber('');
    } catch (err) {
      setMsg(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-ink-900">정산 계좌 <span className="text-ink-400">(1인 1계좌)</span></h2>
      <div className="rounded-4xl border border-hairline bg-surface-canvas p-4">
        {account && !editing ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Landmark className="h-5 w-5 flex-shrink-0 text-brand-clay" />
              <div className="min-w-0">
                <p className="font-medium text-ink-900">{account.bank} {account.masked}</p>
                <p className="text-sm text-ink-500">예금주 {account.holderName} · 본인 명의 확인</p>
              </div>
            </div>
            <button type="button" onClick={() => { setEditing(true); setBankCode(account.bankCode); setHolder(account.holderName); }} className="flex-shrink-0 rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-clay hover:text-brand-clay">
              계좌 바꾸기
            </button>
          </div>
        ) : (
          <form onSubmit={save} className="space-y-3">
            <p className="text-sm text-ink-500">정산금은 본인 명의 계좌 한 곳으로만 보내요. 같은 계좌는 다른 회원이 쓸 수 없어요.</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} required className="rounded-2xl border border-hairline bg-surface-canvas px-3 py-2 text-sm">
                <option value="">은행 선택</option>
                {Object.entries(banks).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
              <input value={number} onChange={(e) => setNumber(e.target.value)} required inputMode="numeric" placeholder="계좌번호(숫자만)" className="rounded-2xl border border-hairline bg-surface-canvas px-3 py-2 text-sm" />
              <input value={holder} onChange={(e) => setHolder(e.target.value)} required placeholder="예금주(가입한 이름)" className="rounded-2xl border border-hairline bg-surface-canvas px-3 py-2 text-sm" />
            </div>
            {msg && <p className="text-sm text-brand-red" role="status">{msg}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="rounded-full bg-brand-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                {busy ? '확인하는 중…' : account ? '이 계좌로 바꾸기' : '등록하기'}
              </button>
              {account && <button type="button" onClick={() => { setEditing(false); setMsg(''); }} className="rounded-full border border-hairline px-4 py-2 text-xs">취소</button>}
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
