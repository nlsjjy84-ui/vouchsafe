'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { PickedRegion, regionLabel } from '@/lib/region-types';
import { RegionPicker } from './RegionPicker';

/** 마이페이지: 내 활동 지역(동 단위) 설정. 설정하면 '지역 찾기'의 전문가 목록과 지도에 공개된다. */
export function MyRegionCard({ canBeFound }: { canBeFound: boolean }) {
  const [region, setRegion] = useState<{ sido: string; sigungu: string | null; dong: string | null } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/regions/me').then((r) => setRegion(r.data || null)).catch(() => undefined).finally(() => setLoaded(true));
  }, []);

  async function pick(p: PickedRegion) {
    setBusy(true); setError(''); setMsg('');
    try {
      await api.put('/regions/me', { sido: p.sido, sigungu: p.sigungu || undefined, dong: p.dong || undefined });
      setRegion({ sido: p.sido.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, ''), sigungu: p.sigungu || null, dong: p.dong || null });
      setMsg('활동 지역을 저장했어요.');
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true); setError(''); setMsg('');
    try {
      await api.delete('/regions/me');
      setRegion(null);
      setMsg('활동 지역을 지웠어요.');
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;
  return (
    <section className="rounded-4xl border border-hairline bg-surface-canvas p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
        <MapPin size={16} /> 내 활동 지역
      </h2>
      <p className="mt-1 text-sm text-ink-600">
        {region ? <b className="text-ink-900">{regionLabel(region)}</b> : '아직 설정하지 않았어요.'}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <RegionPicker label={region ? '지역 바꾸기' : '주소 검색으로 설정'} onPick={pick} />
        {region && (
          <button type="button" disabled={busy} onClick={clear} className="text-xs font-semibold text-ink-500 hover:text-brand-red">
            지역 지우기
          </button>
        )}
        <Link href="/map" className="text-xs font-semibold text-brand-clay hover:underline">지역 찾기 보기</Link>
      </div>
      <p className="mt-2 text-[11px] text-ink-400">
        동 단위까지만 저장해요(상세 주소는 저장 안 함). {canBeFound ? '승인된 전문가 인증이 있으면 지역 찾기의 전문가 목록과 지도에 이름과 함께 공개돼요.' : '전문가 인증을 받으면 지역 찾기에 노출돼요.'}
      </p>
      {msg && <p className="mt-2 text-sm text-brand-sage">{msg}</p>}
      {error && <p className="mt-2 text-sm text-brand-red">{error}</p>}
    </section>
  );
}
