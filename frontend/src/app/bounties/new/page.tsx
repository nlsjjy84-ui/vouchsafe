'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, MapPin, CalendarClock, Wallet } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { DOMAIN_LABELS, DomainType, ServiceType, SERVICE_TYPE_LABELS } from '@/lib/types';
import { FIELD_INPUT_CLASS, FormField, FormSubmitButton, FormErrorText } from '@/components/FormControls';

const DOMAIN_OPTIONS = Object.entries(DOMAIN_LABELS) as [DomainType, string][];
const SERVICE_TYPE_OPTIONS = Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][];

/** 의뢰인이 새 프로젝트를 등록하는 화면 */
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
      <div className="mb-6 flex items-center gap-2">
        <PlusCircle size={20} className="text-brand-clay" />
        <h1 className="text-xl font-bold text-ink-900">프로젝트 등록</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-4xl border border-hairline bg-surface-canvas p-6">
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

        <FormField label="진행 방식" hint="현장 동행: 부동산 임장, 중고차 점검처럼 전문가가 실제 현장에 함께 가야 하는 경우">
          <select
            className={FIELD_INPUT_CLASS}
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value as ServiceType)}
          >
            {SERVICE_TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>

        {serviceType === 'COMPANION' && (
          <div className="space-y-4 rounded-xl bg-tint-gold p-4">
            <FormField label="예약 일시">
              <div className="relative">
                <CalendarClock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="datetime-local"
                  className={`${FIELD_INPUT_CLASS} bg-surface-canvas pl-9`}
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  required={serviceType === 'COMPANION'}
                />
              </div>
            </FormField>
            <FormField label="장소">
              <div className="relative">
                <MapPin size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  className={`${FIELD_INPUT_CLASS} bg-surface-canvas pl-9`}
                  placeholder="예: 서울시 강남구 OO공인중개사"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required={serviceType === 'COMPANION'}
                />
              </div>
            </FormField>
          </div>
        )}

        <FormField label="제목">
          <input
            className={FIELD_INPUT_CLASS}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            minLength={5}
            required
          />
        </FormField>

        <FormField label="상세 내용" hint="(20자 이상)">
          <textarea
            className={`${FIELD_INPUT_CLASS} h-32`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minLength={20}
            required
          />
        </FormField>

        <FormField label="프로젝트 금액" hint="(원)">
          <div className="relative">
            <Wallet size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="number"
              min={10000}
              step={10000}
              className={`${FIELD_INPUT_CLASS} pl-9`}
              value={bountyAmount}
              onChange={(e) => setBountyAmount(Number(e.target.value))}
              required
            />
          </div>
        </FormField>

        {error && <FormErrorText>{error}</FormErrorText>}

        <FormSubmitButton disabled={submitting}>{submitting ? '등록중...' : '프로젝트 등록'}</FormSubmitButton>
      </form>
    </div>
  );
}
