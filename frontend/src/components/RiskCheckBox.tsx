'use client';

import { useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { RiskCheckResponse, RiskLevel, RiskType } from '@/lib/ai-types';
import { Button } from '@/components/Button';
import { AiBadge } from '@/components/AiBadge';

const LEVEL_META: Record<RiskLevel, { label: string; cls: string }> = {
  NONE: { label: '위험 신호 없음', cls: 'bg-tint-sage text-brand-sage' },
  LOW: { label: '주의: 가벼운 신호', cls: 'bg-tint-gold text-brand-gold' },
  MEDIUM: { label: '주의: 확인이 필요해요', cls: 'bg-tint-gold text-brand-gold' },
  HIGH: { label: '경고: 위험 신호', cls: 'bg-tint-red text-brand-red' },
};

const TYPE_LABEL: Record<RiskType, string> = {
  OFF_PLATFORM: '플랫폼 밖 거래 유도',
  CONTACT: '연락처 교환 시도',
  ADVANCE_PAYMENT: '선입금·직접 입금 요구',
  CREDENTIALS: '개인·인증정보 요구',
  GUARANTEE: '비현실적 보장',
  PRESSURE: '재촉·압박 표현',
};

/**
 * 위험 신호 점검 버튼. 글에 플랫폼 밖 거래 유도, 연락처 교환, 선입금 요구 같은 표현이 있는지 알려준다.
 * 막는 기능이 아니라 경고이고, 등록·지원은 그대로 할 수 있다. 신호마다 해당 문장을 그대로 보여준다.
 */
export function RiskCheckBox({ text, kind }: { text: string; kind: 'BOUNTY' | 'APPLICATION' }) {
  const [data, setData] = useState<RiskCheckResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    try {
      const res = await api.post<RiskCheckResponse>('/ai/risk-check', { text, kind });
      setData(res.data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const lv = data ? LEVEL_META[data.level] : null;
  return (
    <div className="rounded-xl border border-hairline bg-surface-raised p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" tone="navy" variant="soft" size="sm" disabled={busy || text.trim().length === 0} onClick={run}>
          <ShieldCheck size={13} className="mr-1 inline" />
          {busy ? '점검 중…' : data ? '다시 점검' : '위험 신호 점검'}
        </Button>
        {lv && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${lv.cls}`}>{data?.level !== 'NONE' && <ShieldAlert size={12} />} {lv.label}</span>}
        <AiBadge meta={data?.meta} />
      </div>
      {error && <p className="mt-2 text-xs text-brand-red">{error}</p>}
      {data && data.signals.length === 0 && (
        <p className="mt-2 text-xs text-ink-500">플랫폼 밖 거래, 연락처 교환, 선입금 요구 같은 표현은 찾지 못했어요. 그래도 의심스러우면 에스크로 밖에서는 거래하지 마세요.</p>
      )}
      {data && data.signals.length > 0 && (
        <ul className="mt-3 space-y-2">
          {data.signals.map((s, i) => (
            <li key={i} className="text-xs text-ink-700">
              <b className="text-ink-900">{TYPE_LABEL[s.type]}</b>
              <span className="ml-1 text-[10px] text-ink-400">{s.source === 'AI' ? 'AI가 찾음' : '규칙으로 찾음'}</span>
              <p className="mt-0.5 rounded-lg bg-surface-canvas px-2 py-1 text-ink-600">&ldquo;{s.quote}&rdquo;</p>
              <p className="mt-0.5 text-ink-500">{s.why}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-ink-400">참고용 경고예요. 등록과 지원은 그대로 할 수 있고, 판단은 사람이 합니다.</p>
    </div>
  );
}
