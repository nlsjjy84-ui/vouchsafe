'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { DOMAIN_LABELS, DomainType, SERVICE_TYPE_LABELS, ServiceType } from '@/lib/types';
import { FEE_RULE_TEXT, MIN_DEAL, OfferDetail, platformFee, won } from '@/lib/offer-types';
import { FIELD_INPUT_CLASS, FormField, FormSubmitButton, FormErrorText } from '@/components/FormControls';

const MAX_IMAGES = 4;
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * 상품 올리기·고치기가 같이 쓰는 입력 폼.
 * - 새 상품: 승인된 인증 분야만 고를 수 있고, 저장한 뒤 고른 사진을 올린다.
 * - 고치기: 분야는 바꿀 수 없다(인증과 묶여 있어서). 사진은 바로 추가·삭제된다.
 * 가격을 넣으면 수수료와 내가 받는 돈을 바로 보여 준다.
 */
export function OfferForm({
  mode,
  domains,
  initial,
  onDone,
}: {
  mode: 'create' | 'edit';
  domains: DomainType[];
  initial?: OfferDetail;
  onDone: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [domainType, setDomainType] = useState<DomainType | ''>(initial?.domainType ?? domains[0] ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState(initial?.price ?? 120000);
  const [serviceType, setServiceType] = useState<ServiceType>(initial?.serviceType ?? 'REMOTE');
  const [area, setArea] = useState(initial?.area ?? '');
  const [days, setDays] = useState(initial?.days ?? 3);
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);

  useEffect(() => {
    if (!domainType && domains[0]) setDomainType(domains[0]);
  }, [domains, domainType]);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function pickFiles(list: FileList | null): File[] {
    const picked: File[] = [];
    if (!list) return picked;
    setError(null);
    for (const f of Array.from(list)) {
      if (!/\.(png|jpe?g)$/i.test(f.name)) { setError('PNG, JPG 사진만 올릴 수 있어요.'); continue; }
      if (f.size > MAX_BYTES) { setError(`${f.name}: 사진 한 장은 5MB 이하여야 해요.`); continue; }
      picked.push(f);
    }
    if (fileRef.current) fileRef.current.value = '';
    return picked;
  }

  async function uploadNow(list: File[]) {
    if (!initial || list.length === 0) return;
    if (images.length + list.length > MAX_IMAGES) { setError(`사진은 ${MAX_IMAGES}장까지예요.`); return; }
    setImgBusy(true);
    try {
      const fd = new FormData();
      list.forEach((f) => fd.append('images', f));
      const res = await api.post<{ images: string[] }>(`/offers/${initial.id}/images`, fd);
      setImages(res.data.images);
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setImgBusy(false);
    }
  }

  async function removeNow(index: number) {
    if (!initial) return;
    setImgBusy(true);
    try {
      const res = await api.delete<{ images: string[] }>(`/offers/${initial.id}/images/${index}`);
      setImages(res.data.images);
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setImgBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const body = {
      title: title.trim(),
      description: description.trim(),
      price,
      serviceType,
      area: serviceType === 'COMPANION' ? area.trim() : undefined,
      days,
    };
    try {
      if (mode === 'create') {
        const res = await api.post<{ id: string }>('/offers', { ...body, domainType });
        if (files.length > 0) {
          const fd = new FormData();
          files.forEach((f) => fd.append('images', f));
          // 사진이 실패해도 상품은 이미 올라갔으니 상세로 보낸다(사진은 고치기에서 다시 올릴 수 있다)
          await api.post(`/offers/${res.data.id}/images`, fd).catch(() => undefined);
        }
        onDone(res.data.id);
      } else if (initial) {
        await api.patch(`/offers/${initial.id}`, body);
        onDone(initial.id);
      }
    } catch (e2) {
      setError(extractErrorMessage(e2));
      setSubmitting(false);
    }
  }

  const fee = platformFee(price);
  const valid = price >= MIN_DEAL;
  const shown = mode === 'edit' ? images : previews;

  return (
    <form onSubmit={submit} className="space-y-4 rounded-4xl border border-hairline bg-surface-canvas p-6">
      <FormField label="분야" hint={mode === 'edit' ? '(바꿀 수 없어요)' : '(승인된 인증만)'}>
        <select
          value={domainType}
          onChange={(e) => setDomainType(e.target.value as DomainType)}
          disabled={mode === 'edit'}
          className={`${FIELD_INPUT_CLASS} disabled:opacity-60`}
          required
        >
          {(mode === 'edit' && initial ? [initial.domainType] : domains).map((d) => (
            <option key={d} value={d}>{DOMAIN_LABELS[d]}</option>
          ))}
        </select>
      </FormField>
      <FormField label="상품 이름" hint="(5~60자)">
        <input value={title} onChange={(e) => setTitle(e.target.value)} minLength={5} maxLength={60} required className={FIELD_INPUT_CLASS} placeholder="예: 중고차 구매 전 동행 점검 (소형·준중형)" />
      </FormField>
      <FormField label="무엇을 해 드리나요" hint="(20자 이상)">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} minLength={20} maxLength={2000} rows={5} required className={FIELD_INPUT_CLASS} placeholder="점검 범위, 걸리는 시간, 결과물(점검표·리포트 등)을 적어 주세요. 연락처는 적을 수 없어요." />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="진행 방식">
          <select value={serviceType} onChange={(e) => setServiceType(e.target.value as ServiceType)} className={FIELD_INPUT_CLASS}>
            {(Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]).map((k) => (
              <option key={k} value={k}>{SERVICE_TYPE_LABELS[k]}</option>
            ))}
          </select>
        </FormField>
        <FormField label="보통 걸리는 날" hint="(일)">
          <input type="number" min={1} max={60} value={days} onChange={(e) => setDays(Number(e.target.value))} className={FIELD_INPUT_CLASS} />
        </FormField>
      </div>
      {serviceType === 'COMPANION' && (
        <FormField label="다닐 수 있는 지역" hint="(예: 서울·경기)">
          <input value={area} onChange={(e) => setArea(e.target.value)} maxLength={40} className={FIELD_INPUT_CLASS} />
        </FormField>
      )}

      <FormField label="사진" hint={`(PNG·JPG, ${MAX_IMAGES}장까지, 1장 5MB)`}>
        <div className="flex flex-wrap gap-2">
          {shown.map((src, i) => (
            <div key={src} className="relative h-20 w-20 overflow-hidden rounded-xl border border-hairline">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="사진 빼기"
                disabled={imgBusy}
                onClick={() => (mode === 'edit' ? removeNow(i) : setFiles(files.filter((_, j) => j !== i)))}
                className="absolute right-1 top-1 rounded-full bg-brand-ink/70 p-0.5 text-white"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {shown.length < MAX_IMAGES && (
            <button
              type="button"
              disabled={imgBusy}
              onClick={() => fileRef.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-hairline-strong text-[11px] text-ink-500 hover:border-brand-sage"
            >
              <ImagePlus size={18} /> {imgBusy ? '올리는 중' : '사진 추가'}
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".png,.jpg,.jpeg"
          multiple
          hidden
          onChange={(e) => {
            const picked = pickFiles(e.target.files);
            if (mode === 'edit') uploadNow(picked);
            else setFiles([...files, ...picked].slice(0, MAX_IMAGES));
          }}
        />
      </FormField>

      <FormField label="가격" hint={`(원, 최소 ${won(MIN_DEAL)})`}>
        <input type="number" min={MIN_DEAL} step={1000} value={price} onChange={(e) => setPrice(Number(e.target.value))} className={FIELD_INPUT_CLASS} />
      </FormField>
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-raised p-3 text-center text-xs">
        <div>
          <p className="text-ink-500">의뢰인이 내는 돈</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink-900">{valid ? won(price) : '–'}</p>
        </div>
        <div>
          <p className="text-ink-500">수수료 (누진식)</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink-900">{valid ? won(fee) : '–'}</p>
        </div>
        <div>
          <p className="text-ink-500">내가 받는 돈</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-brand-sage">{valid ? won(price - fee) : '–'}</p>
        </div>
      </div>
      <p className="text-[11px] text-ink-400">
        수수료는 거래가 끝나 정산될 때만 빠져요. 거래가 안 되면 0원이에요. ({FEE_RULE_TEXT})
        {mode === 'edit' && ' 바꾼 가격은 앞으로 들어오는 의뢰에만 적용돼요.'}
      </p>

      {error && <FormErrorText>{error}</FormErrorText>}
      <FormSubmitButton disabled={submitting || !domainType || !valid}>
        {submitting ? '저장하는 중…' : mode === 'create' ? '상품 올리기' : '고친 내용 저장'}
      </FormSubmitButton>
    </form>
  );
}
