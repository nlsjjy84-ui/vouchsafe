'use client';

import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { DOMAIN_LABELS, DomainType } from '@/lib/types';
import { Button } from '@/components/Button';
import { FormErrorText } from '@/components/FormControls';

interface AlertSettings {
  enabled: boolean;
  domains: DomainType[];
  minAmount: number | null;
  verifiedDomains: DomainType[];
  isDefault: boolean;
}

const MIN_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: '제한 없음' },
  { value: 100000, label: '10만원 이상' },
  { value: 300000, label: '30만원 이상' },
  { value: 500000, label: '50만원 이상' },
  { value: 1000000, label: '100만원 이상' },
];

/** 마이페이지: 맞춤 알림 설정(전문가). 인증받은 분야에 새 프로젝트가 올라오면 알림을 받는다. */
export function MyAlertCard() {
  const [s, setS] = useState<AlertSettings | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [domains, setDomains] = useState<DomainType[]>([]);
  const [minAmount, setMinAmount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  function apply(d: AlertSettings) {
    setS(d);
    setEnabled(d.enabled);
    setDomains(d.domains);
    setMinAmount(d.minAmount);
  }

  useEffect(() => {
    api.get<AlertSettings>('/notifications/alerts/me').then((r) => apply(r.data)).catch(() => undefined);
  }, []);

  if (!s || s.verifiedDomains.length === 0) return null; // 인증받은 분야가 있어야 알림 대상이 된다

  function toggle(d: DomainType) {
    setDomains((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function save() {
    setBusy(true);
    setMsg('');
    setError('');
    try {
      const res = await api.put<AlertSettings>('/notifications/alerts/me', { enabled, domains, minAmount });
      apply(res.data);
      setMsg('알림 설정을 저장했어요.');
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-4xl border border-hairline bg-surface-canvas p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
          <BellRing size={16} /> 맞춤 알림
        </h2>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-brand-clay" />
          새 프로젝트 알림 받기
        </label>
      </div>
      <p className="mt-1 text-xs text-ink-500">
        인증받은 분야에 새 프로젝트가 올라오면 알려드려요. 지원한 프로젝트에서 선정되지 않았을 때도 알려요.
      </p>

      <div className={enabled ? '' : 'pointer-events-none opacity-50'}>
        <p className="mt-4 text-sm font-medium text-ink-700">
          받을 분야 <span className="font-normal text-ink-400">(고르지 않으면 인증받은 분야 전부)</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {s.verifiedDomains.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggle(d)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                domains.includes(d) ? 'bg-brand-ink text-white' : 'bg-surface-raised text-ink-700 hover:bg-hairline'
              }`}
            >
              {DOMAIN_LABELS[d]}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm font-medium text-ink-700">금액 기준</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MIN_OPTIONS.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setMinAmount(o.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                minAmount === o.value ? 'bg-brand-ink text-white' : 'bg-surface-raised text-ink-700 hover:bg-hairline'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button tone="blue" variant="solid" size="sm" disabled={busy} onClick={save}>
          {busy ? '저장 중…' : '설정 저장'}
        </Button>
        {msg && <span className="text-xs text-brand-sage">{msg}</span>}
        {s.isDefault && !msg && <span className="text-xs text-ink-400">아직 설정하지 않아 기본값(전부 받기)이에요.</span>}
      </div>
      {error && <div className="mt-2"><FormErrorText>{error}</FormErrorText></div>}
    </section>
  );
}
