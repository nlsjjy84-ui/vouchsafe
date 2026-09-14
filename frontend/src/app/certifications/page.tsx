'use client';

import { useEffect, useState } from 'react';
import { api, extractErrorMessage } from '@/lib/api';
import {
  Certification,
  DOMAIN_LABELS,
  DomainType,
  TRACK_LABELS,
  VerificationTrack,
} from '@/lib/types';

const DOMAIN_OPTIONS = Object.entries(DOMAIN_LABELS) as [DomainType, string][];
const TRACK_OPTIONS = Object.entries(TRACK_LABELS) as [VerificationTrack, string][];

const STATUS_LABEL: Record<Certification['verifiedStatus'], string> = {
  PENDING: '심사중',
  APPROVED: '승인됨',
  REJECTED: '반려됨',
};

/**
 * 전문가 자격 인증 신청 화면.
 * 기획서 3장 "4개의 증빙 트랙" 중 하나를 골라 도메인+증빙번호를 제출하면,
 * 백엔드의 MockVerificationService가 즉시 형식 검증 후 승인/반려를 알려준다.
 */
export default function CertificationsPage() {
  const [list, setList] = useState<Certification[]>([]);
  const [domainType, setDomainType] = useState<DomainType>(DOMAIN_OPTIONS[0][0]);
  const [track, setTrack] = useState<VerificationTrack>('STANDARD');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadMine() {
    const res = await api.get<Certification[]>('/certifications/me');
    setList(res.data);
  }

  useEffect(() => {
    loadMine().catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('domainType', domainType);
      formData.append('track', track);
      formData.append('licenseNumber', licenseNumber);
      if (evidenceFile) formData.append('evidenceFile', evidenceFile);

      await api.post('/certifications', formData);
      setLicenseNumber('');
      setEvidenceFile(null);
      await loadMine();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">전문가 인증 신청</h1>
        <p className="mt-1 text-sm text-slate-500">
          도메인별로 인증을 받아야 해당 분야의 바운티에 지원할 수 있어요. 증빙 서류를 첨부하면
          AI OCR이 서류 내용과 자격증 번호를 자동으로 대조해요 (지금은 Mock 심사입니다). 서류를
          첨부하지 않으면 번호 형식만 확인하고, 자동 대조 결과가 애매하면 관리자가 직접 검토할
          때까지 &quot;심사중&quot; 상태로 남아요.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded border border-slate-200 bg-white p-5">
        <div>
          <label className="mb-1 block text-sm font-medium">도메인</label>
          <select
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={domainType}
            onChange={(e) => setDomainType(e.target.value as DomainType)}
          >
            {DOMAIN_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">증빙 트랙</label>
          <select
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={track}
            onChange={(e) => setTrack(e.target.value as VerificationTrack)}
          >
            {TRACK_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">증빙 번호</label>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2"
            placeholder="자격증 번호 / 사업자등록번호 / 채널 URL 등"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            증빙 서류 <span className="font-normal text-slate-400">(선택 · 첨부하면 AI OCR 자동 대조)</span>
          </label>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.zip"
            onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-brand-red">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-brand-teal px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? '제출중...' : '인증 신청'}
        </button>
      </form>

      <div>
        <h2 className="mb-3 text-lg font-semibold">내 인증 내역</h2>
        {list.length === 0 && <p className="text-sm text-slate-500">아직 신청한 인증이 없어요.</p>}
        <ul className="space-y-2">
          {list.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded border border-slate-200 bg-white p-4"
            >
              <div>
                <p className="font-medium">{DOMAIN_LABELS[c.domainType]}</p>
                <p className="text-sm text-slate-500">
                  {TRACK_LABELS[c.track]} · {c.licenseNumber}
                </p>
                {c.reviewNote && <p className="mt-1 text-xs text-slate-400">{c.reviewNote}</p>}
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  c.verifiedStatus === 'APPROVED'
                    ? 'bg-teal-50 text-brand-teal'
                    : c.verifiedStatus === 'REJECTED'
                      ? 'bg-red-50 text-brand-red'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {STATUS_LABEL[c.verifiedStatus]}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
