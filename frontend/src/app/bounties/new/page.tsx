'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, extractErrorMessage } from '@/lib/api';
import { DOMAIN_LABELS, DomainType, ServiceType, SERVICE_TYPE_LABELS } from '@/lib/types';

const DOMAIN_OPTIONS = Object.entries(DOMAIN_LABELS) as [DomainType, string][];
const SERVICE_TYPE_OPTIONS = Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][];

/** 의뢰인이 새 바운티(일감)를 등록하는 화면 */
export default function NewBountyPage() {
  const router = useRouter();

  const [domainType, setDomainType] = useState<DomainType>(DOMAIN_OPTIONS[0][0]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bountyAmount, setBountyAmount] = useState(100000);
  const [serviceType, setServiceType] = useState<ServiceType>('REMOTE');
  const [scheduledAt, setScheduledAt] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post('/bounties', {
        domainType,
        title,
        description,
        bountyAmount,
        serviceType,
        // datetime-local input은 초 단위가 없는 로컬 시간 문자열이라, 백엔드가
        // 요구하는 ISO 8601 형식으로 변환해서 보낸다.
        ...(serviceType === 'COMPANION' && scheduledAt
          ? { scheduledAt: new Date(scheduledAt).toISOString() }
          : {}),
        ...(serviceType === 'COMPANION' && location ? { location } : {}),
      });
      router.push(`/bounties/${res.data.id}`);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold">바운티 등록</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
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
          <label className="mb-1 block text-sm font-medium">진행 방식</label>
          <select
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value as ServiceType)}
          >
            {SERVICE_TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            현장 동행: 부동산 임장, 중고차 점검처럼 전문가가 실제 현장에 함께 가야 하는 경우
          </p>
        </div>

        {serviceType === 'COMPANION' && (
          <div className="space-y-4 rounded border border-amber-200 bg-amber-50 p-4">
            <div>
              <label className="mb-1 block text-sm font-medium">예약 일시</label>
              <input
                type="datetime-local"
                className="w-full rounded border border-slate-300 px-3 py-2"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required={serviceType === 'COMPANION'}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">장소</label>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2"
                placeholder="예: 서울시 강남구 OO공인중개사"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required={serviceType === 'COMPANION'}
              />
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">제목</label>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            minLength={5}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">상세 내용 (20자 이상)</label>
          <textarea
            className="h-32 w-full rounded border border-slate-300 px-3 py-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minLength={20}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">바운티 금액 (원)</label>
          <input
            type="number"
            min={10000}
            step={10000}
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={bountyAmount}
            onChange={(e) => setBountyAmount(Number(e.target.value))}
            required
          />
        </div>

        {error && <p className="text-sm text-brand-red">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-brand-teal py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? '등록중...' : '바운티 등록'}
        </button>
      </form>
    </div>
  );
}
