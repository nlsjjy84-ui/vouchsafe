'use client';

import { useState } from 'react';
import { Sparkles, Star } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { AiMeta, REVIEW_KEYWORDS, ReviewDraftResponse } from '@/lib/ai-types';
import { Button } from '@/components/Button';
import { AiBadge, AiNotice } from '@/components/AiBadge';
import { FIELD_INPUT_CLASS, FormErrorText } from '@/components/FormControls';

const SCORES = Array.from({ length: 19 }, (_, i) => 1 + i * 0.5);

function scoreWord(s: number) {
  if (s >= 9) return '매우 만족';
  if (s >= 7) return '만족';
  if (s >= 5) return '보통';
  if (s >= 3) return '아쉬움';
  return '많이 아쉬움';
}

/**
 * 의뢰인 후기 쓰기 (정산 완료 후 1회). 점수는 의뢰인이 직접 고르고, AI는 고른 점수와 키워드로 문장 초안만
 * 만들어 준다. 초안은 얼마든지 고칠 수 있고, 제출 전에는 어디에도 저장되지 않는다.
 * 후기는 공개 거래 사례와 전문가 프로필에 실명 없이 올라간다.
 */
export function ReviewComposer({
  bountyId,
  existingRating,
  existingNote,
  onDone,
}: {
  bountyId: string;
  existingRating: number | null;
  existingNote: string | null;
  onDone: () => void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [hint, setHint] = useState('');
  const [note, setNote] = useState('');
  const [meta, setMeta] = useState<AiMeta | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (existingRating !== null) {
    return (
      <section className="rounded-4xl border border-hairline bg-surface-canvas p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
          <Star size={16} className="text-brand-gold" /> 남긴 후기
        </h2>
        <p className="mt-2 font-display text-2xl text-ink-900">
          {existingRating.toFixed(1)} <span className="text-sm text-ink-500">/ 10 · {scoreWord(existingRating)}</span>
        </p>
        {existingNote && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{existingNote}</p>}
        <p className="mt-2 text-xs text-ink-400">후기는 한 번만 남길 수 있고, 거래 사례와 전문가 프로필에 공개돼요.</p>
      </section>
    );
  }

  function toggle(k: string) {
    setKeywords((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : prev.length >= 6 ? prev : [...prev, k]));
  }

  async function draft() {
    if (rating === null) return;
    setDrafting(true);
    setError('');
    try {
      const res = await api.post<ReviewDraftResponse>(`/ai/bounties/${bountyId}/review-draft`, {
        rating,
        keywords,
        hint: hint.trim() || undefined,
      });
      setNote(res.data.note);
      setMeta(res.data.meta);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setDrafting(false);
    }
  }

  async function submit() {
    if (rating === null) return;
    setSaving(true);
    setError('');
    try {
      await api.post(`/bounties/${bountyId}/rate`, { rating, note: note.trim() || undefined });
      onDone();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-4xl border border-hairline bg-surface-canvas p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
        <Star size={16} className="text-brand-gold" /> 전문가 후기 남기기
      </h2>
      <p className="mt-1 text-xs text-ink-500">
        정산이 끝난 거래예요. 후기는 한 번만 남길 수 있고, 이름 없이 거래 사례와 전문가 프로필에 공개돼요.
      </p>

      <p className="mt-4 text-sm font-medium text-ink-700">
        점수 {rating !== null && <span className="ml-1 font-display text-lg text-ink-900">{rating.toFixed(1)} <span className="text-xs font-normal text-ink-500">{scoreWord(rating)}</span></span>}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SCORES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setRating(s)}
            className={`min-w-[2.6rem] rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              rating === s ? 'bg-brand-ink text-white' : 'bg-surface-raised text-ink-700 hover:bg-hairline'
            }`}
          >
            {s.toFixed(1)}
          </button>
        ))}
      </div>

      {rating !== null && (
        <>
          <p className="mt-5 text-sm font-medium text-ink-700">어땠나요? <span className="font-normal text-ink-400">(골라서 AI 초안에 써요, 선택)</span></p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...REVIEW_KEYWORDS.positive, ...REVIEW_KEYWORDS.negative].map((k) => {
              const on = keywords.includes(k);
              const neg = (REVIEW_KEYWORDS.negative as readonly string[]).includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggle(k)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    on ? (neg ? 'bg-brand-red text-white' : 'bg-brand-sage text-white') : 'bg-surface-raised text-ink-700 hover:bg-hairline'
                  }`}
                >
                  {k}
                </button>
              );
            })}
          </div>

          <input
            value={hint}
            onChange={(e) => setHint(e.target.value.slice(0, 200))}
            placeholder="한마디 덧붙이기 (선택) — 예: 주말에도 답이 와서 도움이 됐어요"
            className={`${FIELD_INPUT_CLASS} mt-3`}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button tone="navy" variant="soft" size="sm" disabled={drafting} onClick={draft}>
              <Sparkles size={13} className="mr-1 inline" />
              {drafting ? '쓰는 중…' : note ? 'AI 초안 다시 쓰기' : 'AI로 후기 초안 쓰기'}
            </Button>
            <AiBadge meta={meta} />
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            rows={4}
            placeholder="직접 쓰거나 AI 초안을 고쳐 쓰세요. (300자까지, 비워도 점수만 남길 수 있어요)"
            className={`${FIELD_INPUT_CLASS} mt-3 resize-y`}
          />
          <div className="mt-1 flex items-center justify-between text-[11px] text-ink-400">
            <span>{meta ? 'AI 초안이에요. 사실과 다르면 꼭 고쳐 주세요.' : ''}</span>
            <span>{note.length} / 300</span>
          </div>
          <AiNotice meta={meta} />
          {error && <div className="mt-2"><FormErrorText>{error}</FormErrorText></div>}

          <div className="mt-4 flex justify-end">
            <Button tone="blue" variant="solid" disabled={saving} onClick={submit}>
              {saving ? '남기는 중…' : '후기 남기기'}
            </Button>
          </div>
        </>
      )}
      {rating === null && error && <div className="mt-2"><FormErrorText>{error}</FormErrorText></div>}
    </section>
  );
}
