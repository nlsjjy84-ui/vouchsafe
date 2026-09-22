'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Users,
  CreditCard,
  Phone,
  PhoneCall,
  FileUp,
  ShieldAlert,
  CheckCircle2,
  Send,
} from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Bounty, BountyApplication, DOMAIN_LABELS, SERVICE_TYPE_LABELS, Transaction } from '@/lib/types';
import { BountyStatusBadge, EscrowStatusBadge } from '@/components/StatusBadge';
import { AvatarModule } from '@/components/AvatarModule';
import { ReputationBadge } from '@/components/ReputationBadge';
import { SuccessPulse } from '@/components/SuccessPulse';
import { payForBounty } from '@/lib/portone';
import { FIELD_INPUT_CLASS, FormErrorText } from '@/components/FormControls';
import { Button } from '@/components/Button';
import { jangdanDelay } from '@/lib/motion';

const CARD_CLASS = 'rounded-4xl border border-hairline bg-surface-canvas p-5';
/* 부가 기능(핵심 콘텐츠가 아닌 유틸리티성 카드)은 표면을 한 단계 낮춰서
   "이건 메인이 아니라 도구"라는 걸 카드 단계에서부터 구분되게 한다. */
const UTILITY_CARD_CLASS = 'rounded-4xl border border-hairline bg-surface-raised p-5';

/**
 * =========================================================================
 * 프로젝트 상세 화면 — 이 프로젝트에서 가장 로직이 많은 화면이다.
 * =========================================================================
 * 같은 프로젝트라도 "보는 사람이 누구냐"에 따라 보여줄 버튼이 완전히 달라진다:
 *   - 의뢰인(글쓴이) + PENDING 상태  → 지원자 목록 + "이 사람으로 결정" 버튼
 *   - 전문가 + PENDING 상태 + 아직 지원 안 함 → "지원하기" 버튼
 *   - 선택된 전문가 + LOCKED 상태 → "결과물 제출" 폼
 *   - 의뢰인 + SUBMITTED 상태 → 제출된 결과물 + "승인(정산)" / "이의제기" 버튼
 * 그래서 화면 로직은 "지금 상태 + 지금 보는 사람이 누구인지" 두 가지 조건을
 * 조합해서 보여줄 UI를 결정하는 방식으로 짰다. (UI 리뉴얼에서는 이 분기 로직은
 * 그대로 두고 스타일만 새 디자인 토큰에 맞춰 다듬었다.)
 * =========================================================================
 */
export default function BountyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [applicants, setApplicants] = useState<BountyApplication[]>([]);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const bountyRes = await api.get<Bounty>(`/bounties/${id}`);
    setBounty(bountyRes.data);

    // 지원자 목록은 아무나 조회 가능하게 열어뒀다 (실제로는 의뢰인 전용으로 제한하는 게 더 안전 - Phase 2)
    const applicantsRes = await api.get<BountyApplication[]>(`/bounties/${id}/applicants`);
    setApplicants(applicantsRes.data);

    // 아직 LOCKED 전이면 거래 내역이 없어서 404가 나는 게 정상 - 조용히 무시한다.
    try {
      const txRes = await api.get<Transaction>(`/transactions/by-bounty/${id}`);
      setTransaction(txRes.data);
    } catch {
      setTransaction(null);
    }
  }, [id]);

  useEffect(() => {
    load().catch((err) => setError(extractErrorMessage(err)));
  }, [load]);

  if (!bounty) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-2/3 animate-pulse rounded-xl bg-surface-raised" />
        <div className="h-24 animate-pulse rounded-4xl bg-surface-raised" />
      </div>
    );
  }

  const isOwner = user?.id === bounty.clientId;
  const isAssignedExpert = user?.id === bounty.assignedExpertId;
  const alreadyApplied = applicants.some((a) => a.expertId === user?.id);

  async function runAction(fn: () => Promise<unknown>) {
    setError(null);
    setMessage(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div className={CARD_CLASS}>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-ink-400">{DOMAIN_LABELS[bounty.domainType]}</span>
          <BountyStatusBadge status={bounty.status} />
          {transaction && <EscrowStatusBadge status={transaction.escrowStatus} />}
        </div>
        <h1 className="font-display text-xl tracking-wide text-ink-900">{bounty.title}</h1>

        {bounty.serviceType === 'COMPANION' && (
          <div className="mt-3 rounded-xl bg-tint-gold px-3 py-2 text-sm text-brand-gold">
            <span className="font-medium">{SERVICE_TYPE_LABELS.COMPANION}</span>
            {bounty.scheduledAt && (
              <span> · {new Date(bounty.scheduledAt).toLocaleString('ko-KR')} 예정</span>
            )}
            {bounty.location && <span> · 장소: {bounty.location}</span>}
          </div>
        )}

        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{bounty.description}</p>
        <p className="mt-4 font-display text-2xl tracking-wide text-ink-900">
          {bounty.bountyAmount.toLocaleString('ko-KR')}원
        </p>
        {transaction && transaction.platformFeeAmount > 0 && (
          <p className="text-xs text-ink-400">
            (플랫폼 수수료 {transaction.platformFeeAmount.toLocaleString('ko-KR')}원 반영됨)
          </p>
        )}
      </div>

      {error && <FormErrorText>{error}</FormErrorText>}
      {message && <SuccessPulse>{message}</SuccessPulse>}

      {/* ── 의뢰인 시점: PENDING 상태 → 지원자 목록에서 한 명 선택 ── */}
      {isOwner && bounty.status === 'PENDING' && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink-900">
            <Users size={16} /> 지원자 목록
          </h2>
          {applicants.length === 0 && (
            <p className="rounded-4xl border border-dashed border-hairline-strong p-6 text-center text-sm text-ink-500">
              아직 지원한 전문가가 없어요.
            </p>
          )}
          <div className="divide-y divide-hairline overflow-hidden rounded-4xl border border-hairline bg-surface-canvas">
            {applicants.map((a, i) => (
              <div
                key={a.id}
                style={jangdanDelay(i)}
                className="animate-stagger-in flex items-center justify-between gap-3 p-4"
              >
                <div className="flex items-center gap-3">
                  <AvatarModule name={a.expert?.name ?? '전문가'} role="EXPERT" />
                  <div>
                    <p className="font-medium text-ink-900">{a.expert?.name ?? '검증된 전문가'}</p>
                    {a.message && <p className="text-sm text-ink-500">{a.message}</p>}
                    <div className="mt-1">
                      <ReputationBadge expertId={a.expertId} />
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  tone="blue"
                  variant="solid"
                  onClick={() =>
                    runAction(() => api.post(`/bounties/${id}/select/${a.id}`)).then(() =>
                      setMessage('전문가를 선택했어요. 결제를 완료하면 에스크로에 자금이 잠깁니다.'),
                    )
                  }
                >
                  이 사람으로 결정
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 전문가 시점: PENDING 상태 + 아직 지원 안 함 → 지원하기 ── */}
      {!isOwner && user?.role !== 'CLIENT' && bounty.status === 'PENDING' && !alreadyApplied && (
        <ApplyForm bountyId={id} onDone={() => runAction(async () => {})} />
      )}
      {!isOwner && alreadyApplied && bounty.status === 'PENDING' && (
        <p className="rounded-4xl border border-dashed border-hairline-strong p-4 text-center text-sm text-ink-500">
          이미 지원했어요. 의뢰인의 선택을 기다리는 중입니다.
        </p>
      )}

      {/* ── 의뢰인 시점: PAYMENT_PENDING 상태 → 실제 결제 진행 ──
          Task #14(실제 PortOne 연동): 전문가를 고른 직후엔 아직 결제가 안 끝난
          상태다. 버튼을 누르면 포트원 결제창(SDK)이 실제로 뜨고, 결제가 끝나면
          서버가 PG에 직접 재확인(confirm-payment)한 뒤에야 에스크로가 잠긴다.
          결제 게이트웨이가 아직 Mock(PAYMENT_GATEWAY_DRIVER=mock)인 환경에서는
          confirm-payment 호출 자체는 결제창 성공 여부와 무관하게 항상 성공 처리된다
          (백엔드가 실제 PG 응답을 확인할 수 없는 개발 환경에서도 흐름을 계속
          테스트할 수 있게 하기 위함). */}
      {isOwner && bounty.status === 'PAYMENT_PENDING' && (
        <PaymentSection
          bountyId={id}
          bountyTitle={bounty.title}
          amount={bounty.bountyAmount}
          paymentId={transaction?.paymentId ?? null}
          onDone={() =>
            runAction(async () => {}).then(() =>
              setMessage('결제가 확인됐어요. 에스크로에 자금이 잠겼습니다.'),
            )
          }
        />
      )}

      {/* ── 안심번호: 매칭 이후(LOCKED~DISPUTED)에는 의뢰인/전문가 둘 다 볼 수 있음 ── */}
      {(isOwner || isAssignedExpert) &&
        ['LOCKED', 'SUBMITTED', 'DISPUTED'].includes(bounty.status) && (
          <SafeNumberSection bountyId={id} />
        )}

      {/* ── 선택된 전문가 시점: LOCKED 상태 → 결과물 제출 ── */}
      {isAssignedExpert && bounty.status === 'LOCKED' && (
        <SubmitForm bountyId={id} onDone={() => runAction(async () => {})} />
      )}

      {/* ── 의뢰인 시점: SUBMITTED 상태 → 승인 또는 이의제기 ── */}
      {isOwner && bounty.status === 'SUBMITTED' && (
        <section className={`space-y-3 ${CARD_CLASS}`}>
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
            <CheckCircle2 size={16} className="text-brand-clay" /> 결과물이 제출됐어요
          </h2>
          <p className="text-sm text-ink-500">
            결과물을 확인한 뒤 문제가 없으면 승인해서 정산을 진행하세요. 문제가 있다면
            이의제기를 통해 자금을 동결하고 중재를 요청할 수 있어요.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              tone="teal"
              variant="solid"
              onClick={() =>
                runAction(() => api.post(`/bounties/${id}/approve`)).then(() =>
                  setMessage('승인 완료! 전문가에게 정산됐습니다.'),
                )
              }
            >
              승인하고 정산하기
            </Button>
            <DisputeButton bountyId={id} onDone={() => runAction(async () => {})} />
          </div>
        </section>
      )}

      {isOwner && bounty.status === 'DISPUTED' && (
        <p className="flex items-center gap-2 rounded-xl bg-tint-red px-4 py-3 text-sm text-brand-red">
          <ShieldAlert size={16} /> 이의제기가 접수되어 자금이 동결됐어요. 관리자 중재 결과를 기다려주세요.
        </p>
      )}
    </div>
  );
}

function ApplyForm({ bountyId, onDone }: { bountyId: string; onDone: () => void }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/bounties/${bountyId}/apply`, { message });
      onDone();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-3 ${CARD_CLASS}`}>
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
        <Send size={16} className="text-brand-clay" /> 이 프로젝트에 지원하기
      </h2>
      <textarea
        className={`${FIELD_INPUT_CLASS} h-24`}
        placeholder="관련 경험이나 접근 방법을 간단히 소개해주세요 (선택)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      {error && <FormErrorText>{error}</FormErrorText>}
      <Button type="submit" disabled={submitting} tone="teal" variant="solid">
        {submitting ? '지원중...' : '지원하기'}
      </Button>
    </form>
  );
}

function SubmitForm({ bountyId, onDone }: { bountyId: string; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('결과물 파일을 첨부해주세요');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('resultFile', file);
      formData.append('note', note);
      await api.post(`/bounties/${bountyId}/submit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onDone();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-3 ${CARD_CLASS}`}>
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
        <FileUp size={16} className="text-brand-clay" /> 결과물 제출
      </h2>
      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-hairline-strong px-3 py-2.5 text-sm text-ink-500 hover:border-brand-clay hover:text-brand-clay">
        <FileUp size={16} />
        {file ? file.name : '파일 선택 (PDF, 이미지, ZIP)'}
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          accept=".pdf,.png,.jpg,.jpeg,.zip"
          className="hidden"
        />
      </label>
      <textarea
        className={`${FIELD_INPUT_CLASS} h-24`}
        placeholder="어떤 작업을 했는지 간단히 설명해주세요"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && <FormErrorText>{error}</FormErrorText>}
      <Button type="submit" disabled={submitting} tone="teal" variant="solid">
        {submitting ? '제출중...' : '결과물 제출'}
      </Button>
    </form>
  );
}

/**
 * 실제 결제창(포트원 SDK)을 띄우고, 결제가 끝나면 서버에 confirm-payment를
 * 호출해 에스크로를 잠그는 컴포넌트. paymentId는 지원자 선택 시 서버가 미리
 * 발급해서 트랜잭션에 저장해둔 값을 그대로 써야 한다 (portone.ts 주석 참고).
 */
function PaymentSection({
  bountyId,
  bountyTitle,
  amount,
  paymentId,
  onDone,
}: {
  bountyId: string;
  bountyTitle: string;
  amount: number;
  paymentId: string | null;
  onDone: () => void;
}) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    if (!paymentId) {
      setError('결제 정보를 아직 불러오지 못했어요. 잠시 후 새로고침해주세요.');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const result = await payForBounty({ paymentId, amount, orderName: bountyTitle });
      if (!result.success) {
        setError(result.message);
        return;
      }
      // 결제창에서는 성공했더라도, 서버가 PG에 직접 재확인해야 진짜로 잠긴다.
      await api.post(`/bounties/${bountyId}/confirm-payment`);
      onDone();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <section className="space-y-3 rounded-4xl bg-tint-gold p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
        <CreditCard size={16} className="text-brand-gold" /> 결제를 완료해주세요
      </h2>
      <p className="text-sm text-ink-700">
        전문가를 선택했어요. 결제가 완료되어야 에스크로에 자금이 잠기고 작업이 시작됩니다.
      </p>
      {error && <FormErrorText>{error}</FormErrorText>}
      <Button onClick={handlePay} disabled={processing} tone="amber" variant="solid">
        {processing ? '결제 진행중...' : `${amount.toLocaleString('ko-KR')}원 결제하기`}
      </Button>
    </section>
  );
}

/**
 * 안심번호 섹션 - 매칭된 의뢰인/전문가가 서로의 실제 전화번호를 노출하지 않고
 * 연락할 수 있게 해주는 기능 (배달앱 등에서 흔히 쓰는 "안심번호"와 같은 개념).
 * 아직 발급 전이면 "발급받기" 버튼, 발급 후에는 번호와 "통화 연결해보기"(Mock) 버튼을 보여준다.
 */
function SafeNumberSection({ bountyId }: { bountyId: string }) {
  const [safeNumber, setSafeNumber] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callNote, setCallNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [myPhone, setMyPhone] = useState('');

  useEffect(() => {
    api
      .get(`/bounties/${bountyId}/safe-number`)
      .then((res) => setSafeNumber(res.data.safeNumber))
      .catch(() => setSafeNumber(null))
      .finally(() => setLoaded(true));
  }, [bountyId]);

  async function handleIssue() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post(`/bounties/${bountyId}/safe-number`);
      setSafeNumber(res.data.safeNumber);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCall() {
    setBusy(true);
    setError(null);
    setCallNote(null);
    try {
      const res = await api.post(`/bounties/${bountyId}/safe-number/call`);
      setCallNote(res.data.note);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRegisterPhone() {
    setBusy(true);
    setError(null);
    try {
      await api.patch('/users/me/phone', { phoneNumber: myPhone });
      await handleIssue();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  const needsPhoneRegistration = !!error && error.includes('전화번호를 등록하지');

  return (
    <section className={`space-y-2 ${UTILITY_CARD_CLASS}`}>
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
        <Phone size={16} className="text-brand-clay" /> 안심번호
      </h2>
      <p className="text-sm text-ink-500">
        서로의 실제 전화번호를 알리지 않고, 안심번호 하나로만 연락을 주고받을 수 있어요.
      </p>

      {error && <FormErrorText>{error}</FormErrorText>}

      {needsPhoneRegistration && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-tint-gold p-3">
          <input
            className={`${FIELD_INPUT_CLASS} w-auto flex-1 bg-surface-canvas`}
            placeholder="내 휴대폰 번호 (010-1234-5678)"
            value={myPhone}
            onChange={(e) => setMyPhone(e.target.value)}
          />
          <Button size="sm" onClick={handleRegisterPhone} disabled={busy || !myPhone} tone="navy" variant="solid">
            내 번호 등록하고 다시 시도
          </Button>
        </div>
      )}

      {safeNumber ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-xl bg-surface-raised px-3 py-2 font-mono text-base text-ink-900">
            {safeNumber}
          </span>
          <Button onClick={handleCall} disabled={busy} tone="navy" variant="outline" icon={<PhoneCall size={14} />}>
            통화 연결해보기
          </Button>
        </div>
      ) : (
        <Button onClick={handleIssue} disabled={busy} tone="navy" variant="soft">
          안심번호 발급받기
        </Button>
      )}

      {callNote && <p className="text-xs text-ink-400">{callNote}</p>}
    </section>
  );
}

function DisputeButton({ bountyId, onDone }: { bountyId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/disputes/bounty/${bountyId}`, { reason });
      onDone();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} tone="red" variant="outline" icon={<ShieldAlert size={14} />}>
        이의제기
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-2">
      <textarea
        className={`${FIELD_INPUT_CLASS} h-20`}
        placeholder="이의제기 사유를 10자 이상 구체적으로 작성해주세요"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {error && <FormErrorText>{error}</FormErrorText>}
      <Button type="submit" tone="red" variant="solid">
        이의제기 접수
      </Button>
    </form>
  );
}
