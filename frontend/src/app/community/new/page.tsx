'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PenSquare, ImagePlus, X } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { DOMAIN_LABELS, DomainType } from '@/lib/types';
import { CATEGORY_LABELS, PostCategory } from '@/lib/community-types';
import { FIELD_INPUT_CLASS, FormField, FormSubmitButton, FormErrorText } from '@/components/FormControls';

const MAX_IMAGES = 4;
const MAX_BYTES = 5 * 1024 * 1024;
const DOMAIN_OPTIONS = Object.entries(DOMAIN_LABELS) as [DomainType, string][];

export default function NewPostPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<PostCategory>('REVIEW');
  const [domainType, setDomainType] = useState<string>('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const categories = (Object.keys(CATEGORY_LABELS) as PostCategory[]).filter((c) => c !== 'NOTICE' || user?.role === 'ADMIN');

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!/\.(png|jpe?g)$/i.test(f.name)) { setError('PNG, JPG 이미지만 첨부할 수 있어요.'); continue; }
      if (f.size > MAX_BYTES) { setError(`${f.name}: 이미지 한 장은 5MB 이하여야 해요.`); continue; }
      if (next.length >= MAX_IMAGES) { setError(`이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있어요.`); break; }
      next.push(f);
    }
    setFiles(next);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('category', category);
      if (domainType) fd.append('domainType', domainType);
      fd.append('title', title);
      fd.append('content', content);
      files.forEach((f) => fd.append('images', f));
      const res = await api.post<{ id: string }>('/community/posts', fd);
      router.push(`/community/${res.data.id}`);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!loading && !user) {
    return (
      <div className="mx-auto max-w-xl rounded-4xl border border-hairline bg-surface-canvas p-8 text-center">
        <p className="text-sm text-ink-600">글을 쓰려면 로그인이 필요해요.</p>
        <Link href="/login" className="mt-3 inline-block text-sm font-semibold text-brand-clay hover:underline">로그인하러 가기</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-2">
        <PenSquare size={20} className="text-brand-clay" />
        <h1 className="text-xl font-bold text-ink-900">글쓰기</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-4xl border border-hairline bg-surface-canvas p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="분류">
            <select value={category} onChange={(e) => setCategory(e.target.value as PostCategory)} className={FIELD_INPUT_CLASS}>
              {categories.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </FormField>
          <FormField label="관련 분야" hint="(선택 - 같은 분야 인증 전문가의 답변에 표시가 붙어요)">
            <select value={domainType} onChange={(e) => setDomainType(e.target.value)} className={FIELD_INPUT_CLASS}>
              <option value="">선택 안 함</option>
              {DOMAIN_OPTIONS.map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="제목">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={FIELD_INPUT_CLASS} placeholder="제목을 입력하세요" />
        </FormField>

        <FormField label="내용" hint={`(${content.length}/5000)`}>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} maxLength={5000} required rows={10} className={FIELD_INPUT_CLASS} placeholder="경험이나 궁금한 점을 자세히 적어 주세요. 연락처·주소 같은 개인정보는 적지 마세요." />
        </FormField>

        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-700">
            이미지 <span className="font-normal text-ink-400">(PNG·JPG, 최대 {MAX_IMAGES}장, 한 장당 5MB)</span>
          </p>
          <div className="flex flex-wrap gap-3">
            {previews.map((src, i) => (
              <div key={src} className="relative h-24 w-24">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`첨부 ${i + 1}`} className="h-24 w-24 rounded-2xl border border-hairline object-cover" />
                <button
                  type="button"
                  onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-ink text-white shadow"
                  aria-label="이미지 삭제"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            {files.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-hairline-strong text-xs text-ink-500 hover:border-brand-clay hover:text-brand-clay"
              >
                <ImagePlus size={20} /> 추가
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
        </div>

        {error && <FormErrorText>{error}</FormErrorText>}
        <FormSubmitButton disabled={submitting || !title.trim() || !content.trim()}>
          {submitting ? '등록 중...' : '등록하기'}
        </FormSubmitButton>
      </form>
    </div>
  );
}
