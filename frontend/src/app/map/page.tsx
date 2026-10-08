'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MapPinned, BadgeCheck, Briefcase, UsersRound, Footprints } from 'lucide-react';
import { api } from '@/lib/api';
import { DOMAIN_LABELS, DomainType } from '@/lib/types';
import { RegionBounty, RegionExpert, RegionFacet, regionLabel } from '@/lib/region-types';
import { RegionMap, MapPoint } from '@/components/RegionMap';
import { JangdanDivider } from '@/components/JangdanDivider';

const DOMAIN_OPTIONS = Object.entries(DOMAIN_LABELS) as [DomainType, string][];

/**
 * 지역 찾기 (/map) — 시/군/구/동 단위로 전문가와 모집 중 프로젝트를 찾는다. 로그인 없이 볼 수 있다.
 * 공개되는 것은 전문가가 직접 설정한 활동 지역과 프로젝트의 만남 지역(동 단위)뿐이고,
 * 의뢰인 개인의 위치는 어디에도 나오지 않는다.
 */
export default function MapPage() {
  const [mode, setMode] = useState<'expert' | 'bounty'>('expert');
  const [facets, setFacets] = useState<RegionFacet[]>([]);
  const [sido, setSido] = useState('');
  const [sigungu, setSigungu] = useState('');
  const [dong, setDong] = useState('');
  const [domain, setDomain] = useState('');
  const [experts, setExperts] = useState<RegionExpert[]>([]);
  const [bounties, setBounties] = useState<RegionBounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');

  useEffect(() => {
    setSido(''); setSigungu(''); setDong('');
    api.get<RegionFacet[]>('/regions/facets', { params: { type: mode } }).then((r) => setFacets(r.data)).catch(() => setFacets([]));
  }, [mode]);

  useEffect(() => {
    setLoading(true);
    setFailed('');
    const params = { sido: sido || undefined, sigungu: sigungu || undefined, dong: dong || undefined, domain: domain || undefined };
    const req = mode === 'expert'
      ? api.get<{ items: RegionExpert[] }>('/regions/experts', { params }).then((r) => setExperts(r.data.items))
      : api.get<{ items: RegionBounty[] }>('/regions/bounties', { params }).then((r) => setBounties(r.data.items));
    req.catch(() => setFailed('불러오지 못했어요. 잠시 후 다시 시도해 주세요.')).finally(() => setLoading(false));
  }, [mode, sido, sigungu, dong, domain]);

  const sidoNode = facets.find((f) => f.name === sido);
  const sigunguNode = sidoNode?.children.find((f) => f.name === sigungu);

  const points: MapPoint[] = useMemo(() => {
    const list: MapPoint[] = [];
    if (mode === 'expert') {
      for (const e of experts) {
        if (e.region.lat == null || e.region.lng == null) continue;
        list.push({ id: e.id, lat: e.region.lat, lng: e.region.lng, title: e.name, sub: `${regionLabel(e.region)} · ${e.verifiedDomains.map((d) => DOMAIN_LABELS[d]).join(', ')}`, href: `/experts/${e.id}` });
      }
    } else {
      for (const b of bounties) {
        if (b.region.lat == null || b.region.lng == null) continue;
        list.push({ id: b.id, lat: b.region.lat, lng: b.region.lng, title: b.title, sub: `${regionLabel(b.region)} · ${b.amount.toLocaleString('ko-KR')}원`, href: `/bounties/${b.id}` });
      }
    }
    return list;
  }, [mode, experts, bounties]);

  const onMapError = useCallback((m: string) => setFailed(m), []);
  const count = mode === 'expert' ? experts.length : bounties.length;
  const sel = 'rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-ink-700 outline-none focus:border-brand-clay disabled:opacity-50';

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-tint-sage text-brand-sage">
          <MapPinned size={20} />
        </span>
        <div>
          <h1 className="font-display text-2xl tracking-wide text-ink-900">지역 찾기</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-500">
            시·군·구·동 단위로 가까운 전문가와 모집 중인 현장 프로젝트를 찾아요. 의뢰인 개인 위치는 공개되지 않고, 프로젝트의 만남 지역(동 단위)만 보여요.
          </p>
        </div>
      </div>

      <JangdanDivider />

      <div className="mt-5 flex gap-2">
        {([['expert', '전문가 찾기', UsersRound], ['bounty', '프로젝트 찾기', Briefcase]] as const).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            onClick={() => setMode(k)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${mode === k ? 'bg-brand-ink text-white' : 'bg-surface-raised text-ink-700 hover:bg-hairline'}`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select className={sel} value={sido} onChange={(e) => { setSido(e.target.value); setSigungu(''); setDong(''); }}>
          <option value="">전체 시/도</option>
          {facets.map((f) => <option key={f.name} value={f.name}>{f.name} ({f.count})</option>)}
        </select>
        <select className={sel} value={sigungu} disabled={!sidoNode} onChange={(e) => { setSigungu(e.target.value); setDong(''); }}>
          <option value="">전체 시/군/구</option>
          {sidoNode?.children.map((f) => <option key={f.name} value={f.name}>{f.name} ({f.count})</option>)}
        </select>
        <select className={sel} value={dong} disabled={!sigunguNode} onChange={(e) => setDong(e.target.value)}>
          <option value="">전체 동</option>
          {sigunguNode?.children.map((f) => <option key={f.name} value={f.name}>{f.name} ({f.count})</option>)}
        </select>
        <select className={sel} value={domain} onChange={(e) => setDomain(e.target.value)}>
          <option value="">모든 분야</option>
          {DOMAIN_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {(sido || domain) && (
          <button type="button" className="text-xs font-semibold text-ink-500 hover:text-brand-clay" onClick={() => { setSido(''); setSigungu(''); setDong(''); setDomain(''); }}>
            초기화
          </button>
        )}
      </div>

      <div className="mt-4">
        <RegionMap points={points} color={mode === 'expert' ? '#b4532a' : '#5b7a5e'} onError={onMapError} />
        <p className="mt-1.5 text-[11px] text-ink-400">핀 위치는 동 단위의 대략적인 위치예요. 숫자는 같은 위치에 있는 개수입니다.</p>
      </div>

      {failed && <p className="mt-4 rounded-xl bg-tint-red px-3 py-2 text-sm text-brand-red">{failed}</p>}

      <p className="mt-5 text-xs text-ink-400">{loading ? '불러오는 중…' : `${count}${mode === 'expert' ? '명' : '건'}`}</p>

      {!loading && count === 0 && !failed && (
        <div className="mt-2 rounded-4xl border border-dashed border-hairline-strong bg-surface-canvas py-12 text-center text-sm text-ink-500">
          이 조건에 맞는 {mode === 'expert' ? '전문가' : '프로젝트'}가 아직 없어요.
        </div>
      )}

      {mode === 'expert' && experts.length > 0 && (
        <ul className="mt-2 grid gap-3 md:grid-cols-2">
          {experts.map((e) => (
            <li key={e.id} className="rounded-3xl border border-hairline bg-surface-canvas p-4 shadow-sm">
              <div className="flex items-baseline justify-between gap-2">
                <Link href={`/experts/${e.id}`} className="text-sm font-semibold text-ink-900 hover:underline">{e.name}</Link>
                <p className="text-xs text-ink-500">{regionLabel(e.region)}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {e.verifiedDomains.map((d) => (
                  <span key={d} className="inline-flex items-center gap-0.5 rounded-full bg-tint-clay px-2 py-0.5 text-[10px] font-bold text-brand-clay">
                    <BadgeCheck size={11} /> {DOMAIN_LABELS[d]}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-600">
                완료 <b className="text-ink-900">{e.completedCount}</b>건 · 시스템 점수 <b className="text-ink-900">{e.score10 !== null ? `${e.score10.toFixed(1)} / 10` : '이력 없음'}</b>
              </p>
            </li>
          ))}
        </ul>
      )}

      {mode === 'bounty' && bounties.length > 0 && (
        <ul className="mt-2 grid gap-3 md:grid-cols-2">
          {bounties.map((b) => (
            <li key={b.id}>
              <Link href={`/bounties/${b.id}`} className="block rounded-3xl border border-hairline bg-surface-canvas p-4 shadow-sm transition-colors hover:border-brand-clay/50">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-surface-raised px-2.5 py-1 text-[11px] font-medium text-ink-600">{DOMAIN_LABELS[b.domainType]}</span>
                  {b.serviceType === 'COMPANION' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-tint-gold px-2.5 py-1 text-[11px] font-bold text-brand-gold"><Footprints size={12} /> 현장 동행</span>
                  )}
                </div>
                <p className="mt-2 line-clamp-1 text-sm font-semibold text-ink-900">{b.title}</p>
                <p className="mt-1 text-xs text-ink-500">{regionLabel(b.region)} · {b.amount.toLocaleString('ko-KR')}원</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
