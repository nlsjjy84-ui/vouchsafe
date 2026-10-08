'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, ListChecks, Scale, Coins, Layers, ClipboardCheck, UsersRound } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import {
  AiMeta,
  AiStatus,
  CheckLine,
  ExpertRecommendation,
  MatchResult,
  MilestoneDraft,
  PriceReference,
  RankingRow,
  RequirementSet,
} from '@/lib/ai-types';
import { DomainType } from '@/lib/types';
import { Button } from '@/components/Button';
import { FIELD_INPUT_CLASS } from '@/components/FormControls';
import { AiBadge, AiNotice } from '@/components/AiBadge';

interface Props {
  bountyId: string;
  status: string;
  domainType: DomainType;
  amount: number;
  isOwner: boolean;
  isAssignedExpert: boolean;
  applicantCount: number;
}

const VERDICT_STYLE: Record<CheckLine['verdict'], { label: string; cls: string }> = {
  MET: { label: '충족 근거 있음', cls: 'bg-tint-sage text-brand-sage' },
  NOT_MET: { label: '미충족', cls: 'bg-tint-red text-brand-red' },
  UNVERIFIABLE: { label: '확인 불가', cls: 'bg-surface-raised text-ink-500' },
};

const EARLY = ['PENDING', 'PAYMENT_PENDING'];

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-hairline bg-surface-canvas p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
        {icon} {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * 프로젝트 상세 화면의 "AI 도우미" 패널.
 * 모든 결과는 참고용이며, 확정/선택/저장은 사람이 직접 한다. 결과마다 AI 호출 여부 배지가 붙는다.
 */
export function AiAssistantPanel({ bountyId, status, domainType, amount, isOwner, isAssignedExpert, applicantCount }: Props) {
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [reqSet, setReqSet] = useState<RequirementSet | null>(null);
  const [reqMeta, setReqMeta] = useState<AiMeta | null>(null);
  const [draftTexts, setDraftTexts] = useState<string[] | null>(null);
  const [ranking, setRanking] = useState<{ rows: RankingRow[]; meta: AiMeta | null } | null>(null);
  const [price, setPrice] = useState<PriceReference | null>(null);
  const [milestones, setMilestones] = useState<MilestoneDraft | null>(null);
  const [checks, setChecks] = useState<{ checks: CheckLine[]; limitation: string; meta: AiMeta } | null>(null);
  const [match, setMatch] = useState<MatchResult<ExpertRecommendation> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadReq = useCallback(async () => {
    try {
      const res = await api.get<RequirementSet | ''>(`/ai/bounties/${bountyId}/requirements`);
      setReqSet(res.data ? (res.data as RequirementSet) : null);
    } catch {
      setReqSet(null);
    }
  }, [bountyId]);

  useEffect(() => {
    api.get<AiStatus>('/ai/status').then((r) => setAi(r.data)).catch(() => setAi(null));
    loadReq();
  }, [loadReq]);

  async function run<T>(key: string, fn: () => Promise<T>, onOk: (v: T) => void) {
    setBusy(key);
    setError('');
    try {
      onOk(await fn());
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (!isOwner && !isAssignedExpert) return null;

  const confirmed = Boolean(reqSet?.confirmedAt);
  const canEditReq = isOwner && (EARLY.includes(status) || (status === 'LOCKED' && !confirmed));
  const canCheck = (isOwner || isAssignedExpert) && ['SUBMITTED', 'DISPUTED'].includes(status) && confirmed;

  return (
    <div className="rounded-4xl border border-hairline bg-surface-raised p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
          <Bot size={18} /> AI 도우미
        </h2>
        {ai && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              ai.mode === 'AI' ? 'bg-tint-clay text-brand-clay' : 'bg-tint-gold text-brand-gold'
            }`}
          >
            {ai.mode === 'AI' ? `AI 연결됨 · ${ai.provider}${ai.model ? ` · ${ai.model}` : ''}` : 'AI 미연결 · 규칙 기반으로 동작'}
          </span>
        )}
      </div>
      {error && <p className="mb-3 rounded-xl bg-tint-red px-3 py-2 text-sm text-brand-red">{error}</p>}

      <div className="space-y-4">
        {/* 1. 요구사항 체크리스트 */}
        <Section icon={<ListChecks size={15} />} title="요구사항 체크리스트">
          {reqSet && confirmed && draftTexts === null && (
            <>
              <ol className="space-y-1 text-sm text-ink-700">
                {reqSet.items.map((i) => (
                  <li key={i.id}><span className="mr-2 font-mono text-xs text-ink-400">{i.id}</span>{i.text}</li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-ink-400">의뢰인이 확정한 기준입니다. 제출물 점검은 이 기준으로만 합니다.</p>
              {canEditReq && (
                <div className="mt-3">
                  <Button tone="navy" variant="outline" size="sm" onClick={() => setDraftTexts(reqSet.items.map((i) => i.text))}>수정하기</Button>
                </div>
              )}
            </>
          )}
          {!confirmed && !canEditReq && <p className="text-sm text-ink-500">아직 확정된 요구사항이 없습니다.</p>}
          {draftTexts === null && canEditReq && !(reqSet && confirmed) && (
            <div className="space-y-2">
              {reqSet && !confirmed && (
                <ol className="space-y-1 text-sm text-ink-700">
                  {reqSet.items.map((i) => <li key={i.id}><span className="mr-2 font-mono text-xs text-ink-400">{i.id}</span>{i.text}</li>)}
                </ol>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button tone="teal" variant="soft" size="sm" disabled={busy === 'draft'}
                  onClick={() => run('draft', async () => (await api.post<{ requirementSet: RequirementSet; meta: AiMeta }>(`/ai/bounties/${bountyId}/requirements/draft`)).data,
                    (v) => { setReqSet(v.requirementSet); setReqMeta(v.meta); setDraftTexts(v.requirementSet.items.map((i) => i.text)); })}>
                  {busy === 'draft' ? '만드는 중…' : 'AI로 초안 만들기'}
                </Button>
                <Button tone="navy" variant="outline" size="sm" onClick={() => setDraftTexts([''])}>직접 작성</Button>
                <AiBadge meta={reqMeta} />
              </div>
            </div>
          )}
          {draftTexts !== null && (
            <div className="space-y-2">
              <div className="flex items-center gap-2"><AiBadge meta={reqMeta} /><span className="text-xs text-ink-400">초안입니다. 고쳐서 확정해야 효력이 생깁니다.</span></div>
              {draftTexts.map((t, idx) => (
                <div key={idx} className="flex gap-2">
                  <input className={FIELD_INPUT_CLASS} value={t} maxLength={200}
                    onChange={(e) => setDraftTexts(draftTexts.map((x, i) => (i === idx ? e.target.value : x)))} />
                  <Button tone="red" variant="text" size="sm" onClick={() => setDraftTexts(draftTexts.filter((_, i) => i !== idx))}>삭제</Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {draftTexts.length < 10 && <Button tone="navy" variant="outline" size="sm" onClick={() => setDraftTexts([...draftTexts, ''])}>항목 추가</Button>}
                <Button tone="teal" size="sm" disabled={busy === 'confirm' || draftTexts.every((t) => !t.trim())}
                  onClick={() => run('confirm', async () => (await api.put(`/ai/bounties/${bountyId}/requirements`, { items: draftTexts.filter((t) => t.trim()) })).data,
                    () => { setDraftTexts(null); loadReq(); })}>
                  {busy === 'confirm' ? '확정 중…' : '이 내용으로 확정'}
                </Button>
                <Button tone="navy" variant="text" size="sm" onClick={() => setDraftTexts(null)}>취소</Button>
              </div>
            </div>
          )}
          <AiNotice meta={reqMeta} />
        </Section>

        {/* 2-0. 맞는 전문가 찾기 (AI 매칭) */}
        {isOwner && status === 'PENDING' && (
          <Section icon={<UsersRound size={15} />} title="맞는 전문가 찾기">
            <div className="flex flex-wrap items-center gap-2">
              <Button tone="teal" variant="soft" size="sm" disabled={busy === 'match'}
                onClick={() => run('match', async () => (await api.get<MatchResult<ExpertRecommendation>>(`/ai/bounties/${bountyId}/expert-recommendations`)).data, setMatch)}>
                {busy === 'match' ? '찾는 중…' : '이 프로젝트에 맞는 전문가 추천받기'}
              </Button>
              {match?.meta && <AiBadge meta={match.meta} />}
            </div>
            {match?.note && <p className="mt-3 text-sm text-ink-600">{match.note}</p>}
            {match && match.recommendations.length > 0 && (
              <ul className="mt-3 space-y-3">
                {match.recommendations.map((r, idx) => (
                  <li key={r.expertId} className="rounded-xl border border-hairline p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-ink-900">
                        {idx + 1}위 · {r.expertName ?? '전문가'}
                        {r.alreadyApplied && <span className="ml-2 rounded-full bg-tint-sage px-2 py-0.5 text-[11px] font-semibold text-brand-sage">이미 지원함</span>}
                      </p>
                      <p className="font-display text-lg text-ink-900">{r.totalScore}<span className="text-xs text-ink-400"> / 100</span></p>
                    </div>
                    <dl className="mt-2 grid gap-1 text-xs text-ink-600 sm:grid-cols-2">
                      {(['reputation', 'certification', 'topicFit', 'experience'] as const).map((k) => (
                        <div key={k} className="flex justify-between gap-2">
                          <dt>{{ reputation: '평판', certification: '인증', topicFit: '주제 적합도', experience: '경력' }[k]}</dt>
                          <dd className="text-right">{r.breakdown[k].points}/{r.breakdown[k].max} <span className="text-ink-400">({r.breakdown[k].note})</span></dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-ink-400">이 분야에서 승인된 자격이 있는 전문가만 후보가 됩니다. 점수는 참고용이고 선택은 의뢰인이 직접 합니다. AI에는 이름 대신 후보 A/B 라벨과 완료 프로젝트 제목만 전달됩니다.</p>
            {match?.meta && <AiNotice meta={match.meta} />}
          </Section>
        )}

        {/* 2. 지원자 추천 정렬 */}
        {isOwner && status === 'PENDING' && applicantCount > 0 && (
          <Section icon={<Scale size={15} />} title="지원자 추천 정렬">
            <div className="flex flex-wrap items-center gap-2">
              <Button tone="teal" variant="soft" size="sm" disabled={busy === 'rank'}
                onClick={() => run('rank', async () => (await api.get<{ ranking: RankingRow[]; meta: AiMeta | null }>(`/ai/bounties/${bountyId}/applicants/ranking`)).data,
                  (v) => setRanking({ rows: v.ranking, meta: v.meta }))}>
                {busy === 'rank' ? '계산 중…' : '지원자 점수 보기'}
              </Button>
              {ranking && <AiBadge meta={ranking.meta} />}
            </div>
            {ranking && (
              <ul className="mt-3 space-y-3">
                {ranking.rows.map((r, idx) => (
                  <li key={r.applicationId} className="rounded-xl border border-hairline p-3">
                    <div className="flex items-baseline justify-between">
                      <p className="text-sm font-semibold text-ink-900">{idx + 1}위 · {r.expertName ?? r.label}</p>
                      <p className="font-display text-lg text-ink-900">{r.totalScore}<span className="text-xs text-ink-400"> / 100</span></p>
                    </div>
                    <dl className="mt-2 grid gap-1 text-xs text-ink-600 sm:grid-cols-2">
                      {(['reputation', 'certification', 'messageFit', 'messageEffort'] as const).map((k) => (
                        <div key={k} className="flex justify-between gap-2">
                          <dt>{{ reputation: '평판', certification: '인증', messageFit: '메시지 적합도', messageEffort: '메시지 성의' }[k]}</dt>
                          <dd className="text-right">{r.breakdown[k].points}/{r.breakdown[k].max} <span className="text-ink-400">({r.breakdown[k].note})</span></dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-ink-400">점수는 참고용입니다. 지원자 선택은 의뢰인이 직접 합니다. AI에는 이름 대신 지원자 A/B 라벨만 전달됩니다.</p>
            {ranking && <AiNotice meta={ranking.meta} />}
          </Section>
        )}

        {/* 3. 가격 참고 */}
        {isOwner && EARLY.includes(status) && (
          <Section icon={<Coins size={15} />} title="가격 참고">
            <div className="flex flex-wrap items-center gap-2">
              <Button tone="teal" variant="soft" size="sm" disabled={busy === 'price'}
                onClick={() => run('price', async () => (await api.get<PriceReference>(`/ai/price-reference`, { params: { domainType, amount, bountyId } })).data, setPrice)}>
                {busy === 'price' ? '조회 중…' : '같은 분야 정산 사례와 비교'}
              </Button>
              {price?.meta && <AiBadge meta={price.meta} />}
            </div>
            {price && !price.enoughData && <p className="mt-3 text-sm text-ink-600">{price.message}</p>}
            {price?.enoughData && price.stats && (
              <div className="mt-3 text-sm text-ink-700">
                <p>정산 사례 {price.stats.n}건 · 중앙값 {price.stats.median.toLocaleString('ko-KR')}원 · 중간 50% 범위 {price.stats.p25.toLocaleString('ko-KR')}~{price.stats.p75.toLocaleString('ko-KR')}원</p>
                <p className="mt-1">{price.comment}</p>
                <AiNotice meta={price.meta} />
              </div>
            )}
          </Section>
        )}

        {/* 4. 마일스톤 초안 */}
        {isOwner && EARLY.includes(status) && (
          <Section icon={<Layers size={15} />} title="마일스톤 초안">
            <div className="flex flex-wrap items-center gap-2">
              <Button tone="teal" variant="soft" size="sm" disabled={busy === 'ms'}
                onClick={() => run('ms', async () => (await api.post<MilestoneDraft>(`/ai/bounties/${bountyId}/milestone-draft`)).data, setMilestones)}>
                {busy === 'ms' ? '만드는 중…' : '단계별 초안 만들기'}
              </Button>
              {milestones && <AiBadge meta={milestones.meta} />}
            </div>
            {milestones && (
              <div className="mt-3">
                <ul className="space-y-1 text-sm text-ink-700">
                  {milestones.milestones.map((m, i) => (
                    <li key={i} className="flex justify-between gap-3"><span>{i + 1}. {m.title}</span><span>{m.amount.toLocaleString('ko-KR')}원</span></li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-ink-400">합계 {milestones.totalAmount.toLocaleString('ko-KR')}원 (금액은 서버가 계산해 합이 정확히 맞습니다). {milestones.note}</p>
                <AiNotice meta={milestones.meta} />
              </div>
            )}
          </Section>
        )}

        {/* 5. 제출물 1차 점검 */}
        {canCheck && (
          <Section icon={<ClipboardCheck size={15} />} title="제출물 1차 점검">
            <div className="flex flex-wrap items-center gap-2">
              <Button tone="teal" variant="soft" size="sm" disabled={busy === 'check'}
                onClick={() => run('check', async () => (await api.post(`/ai/bounties/${bountyId}/submission-check`)).data, setChecks)}>
                {busy === 'check' ? '점검 중…' : '요구사항 대비 점검'}
              </Button>
              {checks && <AiBadge meta={checks.meta} />}
            </div>
            {checks && (
              <div className="mt-3 space-y-2">
                {checks.checks.map((c) => (
                  <div key={c.id} className="rounded-xl border border-hairline p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-ink-400">{c.id}</span>
                      <span className="text-ink-900">{c.text}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${VERDICT_STYLE[c.verdict].cls}`}>{VERDICT_STYLE[c.verdict].label}</span>
                    </div>
                    {c.evidence && <p className="mt-1 text-xs text-ink-500">근거(제출 메모 인용): “{c.evidence}”</p>}
                    {c.comment && <p className="mt-1 text-xs text-ink-500">{c.comment}</p>}
                  </div>
                ))}
                <p className="text-xs text-brand-gold">{checks.limitation}</p>
                <AiNotice meta={checks.meta} />
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}
