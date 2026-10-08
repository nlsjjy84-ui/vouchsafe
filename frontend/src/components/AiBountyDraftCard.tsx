'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { BountyDraftResponse } from '@/lib/ai-types';
import { DOMAIN_LABELS, DomainType } from '@/lib/types';
import { Button } from '@/components/Button';
import { AiBadge, AiNotice } from '@/components/AiBadge';
import { FIELD_INPUT_CLASS } from '@/components/FormControls';

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const round10k = (n: number) => Math.max(10000, Math.round(n / 10000) * 10000);

/**
 * 프로젝트 등록 화면 위쪽의 AI 초안 카드. 한두 문장만 적으면 분야·제목·상세 내용 초안을 아래 입력칸에 채워 준다.
 * 금액은 AI가 정하지 않고, 같은 분야에서 실제로 정산된 금액 범위만 참고로 보여준다. 채워진 내용은 모두 고칠 수 있다.
 */
export function AiBountyDraftCard({
  serviceType,
  onApply,
  onPickAmount,
}: {
  serviceType: 'REMOTE' | 'COMPANION';
  onApply: (d: { domainType: DomainType | null; title: string; description: string }) => void;
  onPickAmount: (amount: number) => void;
}) {
  const [idea, setIdea] = useState('');
  const [data, setData] = useState<BountyDraftResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    try {
      const res = await api.post<BountyDraftResponse>('/ai/bounty-draft', { idea, serviceType });
      setData(res.data);
      onApply({
        domainType: (res.data.draft.domainType as DomainType | null) ?? null,
        title: res.data.draft.title,
        description: res.data.draft.description,
      });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const hint = data?.priceHint;
  return (
    <div className="mb-5 rounded-4xl border border-hairline bg-tint-clay p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
        <Sparkles size={16} className="text-brand-clay" /> AI로 공고 초안 만들기
      </h2>
      <p className="mt-1 text-xs text-ink-600">필요한 일을 한두 문장으로 적으면 분야, 제목, 상세 내용 초안을 아래에 채워 드려요.</p>
      <textarea
        value={idea}
        onChange={(e) => setIdea(e.target.value.slice(0, 800))}
        rows={3}
        placeholder="예: 이번 주말에 중고차 3대를 보러 가는데, 엔진 상태랑 사고 이력을 같이 봐줄 사람이 필요해요."
        className={`${FIELD_INPUT_CLASS} mt-3 resize-y bg-surface-canvas`}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" tone="navy" variant="soft" size="sm" disabled={busy || idea.trim().length < 10} onClick={run}>
          {busy ? '만드는 중…' : data ? '초안 다시 만들기' : '초안 만들기'}
        </Button>
        <AiBadge meta={data?.meta} />
        <span className="text-[11px] text-ink-400">{idea.trim().length < 10 ? '10자 이상 적어 주세요' : `${idea.length} / 800`}</span>
      </div>
      {error && <p className="mt-2 text-xs text-brand-red">{error}</p>}

      {data && (
        <div className="mt-4 space-y-3 text-sm text-ink-700">
          <p className="text-xs">
            {data.draft.domainType
              ? `분야를 "${DOMAIN_LABELS[data.draft.domainType as DomainType]}"로 골랐어요. 맞는지 확인해 주세요.`
              : '분야를 정하지 못했어요. 아래에서 직접 골라 주세요.'}
          </p>
          {hint && (
            <div className="rounded-xl bg-surface-canvas p-3 text-xs">
              같은 분야에서 정산된 {hint.n}건의 금액은 <b className="text-ink-900">{won(hint.p25)} ~ {won(hint.p75)}</b>, 가운데 값은 <b className="text-ink-900">{won(hint.median)}</b>이에요.
              <button type="button" onClick={() => onPickAmount(round10k(hint.median))} className="ml-2 font-semibold text-brand-clay hover:underline">
                가운데 값으로 채우기
              </button>
            </div>
          )}
          {data.draft.missing.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-ink-500">더 적어 주면 전문가가 이해하기 쉬워요</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                {data.draft.missing.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
          <AiNotice meta={data.meta} />
        </div>
      )}
    </div>
  );
}
