'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api, extractErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Bounty, BountyApplication, DOMAIN_LABELS, SERVICE_TYPE_LABELS, Transaction } from '@/lib/types';
import { BountyStatusBadge, EscrowStatusBadge } from '@/components/StatusBadge';
import { AvatarModule } from '@/components/AvatarModule';
import { ReputationBadge } from '@/components/ReputationBadge';
import { payForBounty } from '@/lib/portone';

/**
 * =========================================================================
 * 바운티 상세 화면 — 이 프로젝트에서 가장 로직이 많은 화면이다.
 * =========================================================================
 * 같은 바운티라도 "보는 사람이 누구냐"에 따라 보여줄 버튼이 완전히 달라진다:
 *   - 의뢰인(글쓴이) + PENDING 상태  → 지원자 목록 + "이 사람으로 결정" 버튼
 *   - 전문가 + PENDING 상태 + 아직 지원 안 함 → "지원하기" 버튼
 *   - 선택된 전문가 + LOCKED 상태 → "결과물 제출" 폼
 *   - 의뢰인 + SUBMITTED 상태 → 제출된 결과물 + "승인(정산)" / "이의제기" 버튼
 * 그래서 화면 로직은 "지금 상태 + 지금 보는 사람이 누구인지" 두 가지 조건을
 * 조합해서 보여줄 UI를 결정하는 방식으로 짰다.
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

  if (!bounty) return <p className="text-sm text-slate-500">불러오는 중...</p>;

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
      <div>
        <div className="mb-2 flex items-center gap-3">
          <span className="text-xs font-medium text-slate-400">{DOMAIN_LABELS[bounty.domainType]}</span>
          <BountyStatusBadge status={bounty.status} />
          {transaction && <EscrowStatusBadge status={transaction.escrowStatus} />}
        </div>
        <h1 className="text-2xl font-semibold">{bounty.title}</h1>

        {bounty.serviceType === 'COMPANION' && (
          <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span className="font-medium">{SERVICE_TYPE_LABELS.COMPANION}</span>
            {bounty.scheduledAt && (
              <span> · {new Date(bounty.scheduledAt).toLocaleString('ko-KR')} 예정</span>
            )}
            {bounty.location && <span> · 장소: {bounty.location}</span>}
          </div>
        )}

        <p className="mt-2 whitespace-pre-wrap text-slate-600">{bounty.description}</p>
        <p className="mt-3 text-xl font-semibold text-brand-navy">
          {bounty.bountyAmount.toLocaleString()}원
        </p>
        {transaction && transaction.platformFeeAmount > 0 && (
          <p className="text-sm text-slate-400">
            (플랫폼 수수료 {transaction.platformFeeAmount.toLocaleString()}원 반영됨)
          </p>
        )}
      </div>

      {error && <p className="rounded bg-red-50 p-3 text-sm text-brand-red">{error}</p>}
      {message && <p className="rounded bg-teal-50 p-3 text-sm text-brand-teal">{message}</p>}

      {/* ── 의뢰인 시점: PENDING 상태 → 지원자 목록에서 한 명 선택 ── */}
      {isOwner && bounty.status === 'PENDING' && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">지원자 목록</h2>
          {applicants.length === 0 && (
            <p className="text-sm text-slate-500">아직 지원한 전문가가 없어요.</p>
          )}
          <ul className="space-y-2">
            {applicants.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded border border-slate-200 bg-white p-4"
              >
                <div className="flex items-center gap-3">
                  <AvatarModule name={a.expert?.name ?? '전문가'} role="EXPERT" />
                  <div>
                    <p className="font-medium">{a.expert?.name ?? '검증된 전문가'}</p>
                    {a.message && <p className="text-sm text-slate-500">{a.message}</p>}
                    <div className="mt-1">
                      <ReputationBadge expertId={a.expertId} />
                    </div>
                  </div>
                </div>
                <button
                  onClick={() =>
                    runAction(() => api.post(`/bounties/${id}/select/${a.id}`)).then(() =>
                      setMessage('전문가를 선택했어요. 이제 결제를 완료하면 에스크로에 자금이 잠깁니다.'),
                    )
                  }
                  className="rounded bg-brand-teal px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  이 사람으로 결정
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 전문가 시점: PENDING 상태 + 아직 지원 안 함 → 지원하기 ── */}
      {!isOwner && user?.role !== 'CLIENT' && bounty.status === 'PENDING' && !alreadyApplied && (
        <ApplyForm bountyId={id} onDone={() => runAction(async () => {})} />
      )}
      {!isOwner && alreadyApplied && bounty.status === 'PENDING' && (
        <p className="text-sm text-slate-500">이미 지원했어요. 의뢰인의 선택을 기다리는 중입니다.</p>
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
        <section className="space-y-3 rounded border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">결과물이 제출됐어요</h2>
          <p className="text-sm text-slate-500">
            결과물을 확인한 뒤 문제가 없으면 승인해서 정산을 진행하세요. 문제가 있다면
            이의제기를 통해 자금을 동결하고 중재를 요청할 수 있어요.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() =>
                runAction(() => api.post(`/bounties/${id}/approve`)).then(() =>
                  setMessage('승인 완료! 전문가에게 정산됐습니다.'),
                )
              }
              className="rounded bg-brand-teal px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              승인하고 정산하기
            </button>
            <DisputeButton bountyId={id} onDone={() => runAction(async () => {})} />
          </div>
        </section>
      )}

      {isOwner && bounty.status === 'DISPUTED' && (
        <p className="rounded bg-red-50 p-4 text-sm text-brand-red">
          이의제기가 접수되어 자금이 동결됐어요. 관리자 중재 결과를 기다려주세요.
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
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">이 바운티에 지원하기</h2>
      <textarea
        className="h-24 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        placeholder="관련 경험이나 접근 방법을 간단히 소개해주세요 (선택)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      {error && <p className="text-sm text-brand-red">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-brand-teal px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? '지원중...' : '지원하기'}
      </button>
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
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">결과물 제출</h2>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        accept=".pdf,.png,.jpg,.jpeg,.zip"
      />
      <textarea
        className="h-24 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        placeholder="어떤 작업을 했는지 간단히 설명해주세요"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && <p className="text-sm text-brand-red">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-brand-teal px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? '제출중...' : '결과물 제출'}
      </button>
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
    <section className="space-y-3 rounded border border-amber-200 bg-amber-50 p-5">
      <h2 className="text-lg font-semibold">결제를 완료해주세요</h2>
      <p className="text-sm text-slate-600">
        전문가를 선택했어요. 결제가 완료되어야 에스크로에 자금이 잠기고 작업이 시작됩니다.
      </p>
      {error && <p className="text-sm text-brand-red">{error}</p>}
      <button
        onClick={handlePay}
        disabled={processing}
        className="rounded bg-brand-amber px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {processing ? '결제 진행중...' : `${amount.toLocaleString()}원 결제하기`}
      </button>
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
    <section className="space-y-2 rounded border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">안심번호</h2>
      <p className="text-sm text-slate-500">
        서로의 실제 전화번호를 알리지 않고, 안심번호 하나로만 연락을 주고받을 수 있어요.
      </p>

      {error && <p className="text-sm text-brand-red">{error}</p>}

      {needsPhoneRegistration && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-amber-200 bg-amber-50 p-3">
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="내 휴대폰 번호 (010-1234-5678)"
            value={myPhone}
            onChange={(e) => setMyPhone(e.target.value)}
          />
          <button
            onClick={handleRegisterPhone}
            disabled={busy || !myPhone}
            className="rounded bg-brand-teal px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            내 번호 등록하고 다시 시도
          </button>
        </div>
      )}

      {safeNumber ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded bg-slate-100 px-3 py-2 font-mono text-base">{safeNumber}</span>
          <button
            onClick={handleCall}
            disabled={busy}
            className="rounded bg-brand-teal px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            통화 연결해보기
          </button>
        </div>
      ) : (
        <button
          onClick={handleIssue}
          disabled={busy}
          className="rounded bg-brand-teal px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          안심번호 발급받기
        </button>
      )}

      {callNote && <p className="text-xs text-slate-400">{callNote}</p>}
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
      <button
        onClick={() => setOpen(true)}
        className="rounded border border-brand-red px-4 py-2 text-sm font-medium text-brand-red hover:bg-red-50"
      >
        이의제기
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-2">
      <textarea
        className="h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        placeholder="이의제기 사유를 10자 이상 구체적으로 작성해주세요"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {error && <p className="text-sm text-brand-red">{error}</p>}
      <button
        type="submit"
        className="rounded bg-brand-red px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        이의제기 접수
      </button>
    </form>
  );
}
