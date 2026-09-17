'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, Upload, Sparkles } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import {
  Certification,
  DOMAIN_LABELS,
  DomainType,
  TRACK_LABELS,
  VerificationTrack,
} from '@/lib/types';
import { FIELD_INPUT_CLASS, FormField, FormErrorText } from '@/components/FormControls';
import { jangdanDelay } from '@/lib/motion';

const DOMAIN_OPTIONS = Object.entries(DOMAIN_LABELS) as [DomainType, string][];
const TRACK_OPTIONS = Object.entries(TRACK_LABELS) as [VerificationTrack, string][];

const STATUS_LABEL: Record<Certification['verifiedStatus'], string> = {
  PENDING: '심사중',
  APPROVED: '승인됨',
  REJECTED: '반려됨',
};

const STATUS_STYLE: Record<Certification['verifiedStatus'], string> = {
  PENDING: 'bg-surface-raised text-ink-500',
  APPROVED: 'bg-tint-clay text-brand-clay',
  REJECTED: 'bg-tint-red text-brand-red',
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
      <div className="flex items-start gap-2">
        <ShieldCheck size={22} className="mt-0.5 flex-shrink-0 text-brand-clay" />
        <div>
          <h1 className="text-xl font-bold text-ink-900">전문가 인증 신청</h1>
          <p className="mt-1 text-sm text-ink-500">
            도메인별로 인증을 받아야 해당 분야의 바운티에 지원할 수 있어요. 증빙 서류를 첨부하면
            AI OCR이 서류 내용과 자격증 번호를 자동으로 대조해요 (지금은 Mock 심사입니다). 서류를
            첨부하지 않으면 번호 형식만 확인하고, 자동 대조 결과가 애매하면 관리자가 직접 검토할
            때까지 &quot;심사중&quot; 상태로 남아요.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-4xl border border-hairline bg-surface-canvas p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="도메인">
            <select
              className={FIELD_INPUT_CLASS}
              value={domainType}
              onChange={(e) => setDomainType(e.target.value as DomainType)}
            >
              {DOMAIN_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="증빙 트랙">
            <select
              className={FIELD_INPUT_CLASS}
              value={track}
              onChange={(e) => setTrack(e.target.value as VerificationTrack)}
            >
              {TRACK_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="증빙 번호">
          <input
            className={FIELD_INPUT_CLASS}
            placeholder="자격증 번호 / 사업자등록번호 / 채널 URL 등"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            required
          />
        </FormField>

        <FormField label="증빙 서류" hint="(선택 · 첨부하면 AI OCR 자동 대조)">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-hairline-strong px-3 py-2.5 text-sm text-ink-500 hover:border-brand-clay hover:text-brand-clay">
            <Upload size={16} />
            {evidenceFile ? evidenceFile.name : '파일 선택 (PDF, 이미지, ZIP)'}
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.zip"
              onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
        </FormField>

        {error && <FormErrorText>{error}</FormErrorText>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-clay px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-clayDeep hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {submitting ? '제출중...' : '인증 신청'}
        </button>
      </form>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink-900">
          <Sparkles size={16} className="text-brand-clay" /> 내 인증 내역
        </h2>
        {list.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-4xl border border-dashed border-hairline-strong p-8 text-center">
            <ShieldCheck size={26} className="text-ink-400" />
            <p className="text-sm text-ink-500">아직 신청한 인증이 없어요. 위 폼으로 첫 인증을 신청해보세요.</p>
          </div>
        )}
        {list.length > 0 && (
          <div className="divide-y divide-hairline overflow-hidden rounded-4xl border border-hairline bg-surface-canvas">
            {list.map((c, i) => (
              <div key={c.id} style={jangdanDelay(i)} className="animate-stagger-in flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-ink-900">{DOMAIN_LABELS[c.domainType]}</p>
                  <p className="text-sm text-ink-500">
                    {TRACK_LABELS[c.track]} · {c.licenseNumber}
                  </p>
                  {c.reviewNote && <p className="mt-1 text-xs text-ink-400">{c.reviewNote}</p>}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[c.verifiedStatus]}`}>
                  {STATUS_LABEL[c.verifiedStatus]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
