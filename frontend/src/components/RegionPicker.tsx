'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { PickedRegion } from '@/lib/region-types';

declare global {
  interface Window {
    daum?: { Postcode: new (opts: Record<string, unknown>) => { embed: (el: HTMLElement) => void } };
  }
}

const POSTCODE_SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

function loadPostcode(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.daum?.Postcode) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${POSTCODE_SRC}"]`);
    const s = existing ?? document.createElement('script');
    s.addEventListener('load', () => resolve());
    s.addEventListener('error', () => reject(new Error('주소 검색을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.')));
    if (!existing) {
      s.src = POSTCODE_SRC;
      s.async = true;
      document.body.appendChild(s);
    }
  });
}

/**
 * 시/군/구/동 선택. 다음(카카오) 주소검색 위젯을 쓰므로 API 키가 필요 없다.
 * 위젯이 돌려주는 시도·시군구·법정동만 쓰고, 상세 주소는 저장하지 않는다.
 */
export function RegionPicker({
  label = '주소 검색',
  onPick,
}: {
  label?: string;
  onPick: (r: PickedRegion) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setError('');
    loadPostcode()
      .then(() => {
        if (!alive || !boxRef.current || !window.daum) return;
        new window.daum.Postcode({
          width: '100%',
          height: '100%',
          oncomplete: (d: { sido: string; sigungu: string; bname: string; bname2?: string; roadAddress?: string; jibunAddress?: string; address: string }) => {
            onPick({
              sido: d.sido,
              sigungu: d.sigungu,
              dong: d.bname || d.bname2 || '',
              address: d.roadAddress || d.jibunAddress || d.address,
            });
            setOpen(false);
          },
        }).embed(boxRef.current);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-hairline"
      >
        <MapPin size={15} /> {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="relative h-[520px] w-full max-w-md overflow-hidden rounded-3xl bg-surface-canvas shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-1.5 text-ink-900" aria-label="닫기">
              <X size={16} />
            </button>
            {error ? <p className="p-6 text-sm text-brand-red">{error}</p> : <div ref={boxRef} className="h-full w-full" />}
          </div>
        </div>
      )}
    </>
  );
}
