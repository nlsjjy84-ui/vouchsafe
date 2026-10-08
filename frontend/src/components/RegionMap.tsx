'use client';

import { useEffect, useRef } from 'react';

/**
 * 지도 한 장. NEXT_PUBLIC_KAKAO_MAP_KEY(카카오 JavaScript 키)가 있으면 카카오맵, 없으면
 * Leaflet + OpenStreetMap(키 불필요)으로 그린다. 호출하는 쪽은 어느 쪽인지 몰라도 된다.
 * 같은 좌표의 항목은 한 핀으로 묶어 개수를 보여 준다.
 */
export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  title: string;
  sub?: string;
  href?: string;
}

const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';

type L = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function loadLeaflet(): Promise<L> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { L?: L };
    if (w.L) return resolve(w.L);
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = LEAFLET_CSS;
      document.head.appendChild(css);
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LEAFLET_JS}"]`);
    const s = existing ?? document.createElement('script');
    s.addEventListener('load', () => resolve((window as unknown as { L: L }).L));
    s.addEventListener('error', () => reject(new Error('지도를 불러오지 못했어요.')));
    if (!existing) {
      s.src = LEAFLET_JS;
      s.async = true;
      document.body.appendChild(s);
    }
  });
}

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function LeafletMap({ points, color = '#b4532a', onError }: { points: MapPoint[]; color?: string; onError?: (m: string) => void }) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L>(null);
  const layerRef = useRef<L>(null);

  useEffect(() => {
    let alive = true;
    loadLeaflet()
      .then((Lf) => {
        if (!alive || !elRef.current) return;
        if (!mapRef.current) {
          mapRef.current = Lf.map(elRef.current, { scrollWheelZoom: true }).setView([36.5, 127.8], 7);
          Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(mapRef.current);
          layerRef.current = Lf.layerGroup().addTo(mapRef.current);
        }
        layerRef.current.clearLayers();
        const groups = new Map<string, MapPoint[]>();
        for (const p of points) {
          const k = `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
          groups.set(k, [...(groups.get(k) ?? []), p]);
        }
        const bounds: [number, number][] = [];
        groups.forEach((list) => {
          const { lat, lng } = list[0];
          const icon = Lf.divIcon({
            className: '',
            html: `<div style="width:34px;height:34px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font:700 13px sans-serif;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">${list.length}</div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          });
          const body = list
            .slice(0, 8)
            .map((p) => `<div style="margin:4px 0">${p.href ? `<a href="${esc(p.href)}" style="font-weight:600">${esc(p.title)}</a>` : `<b>${esc(p.title)}</b>`}${p.sub ? `<div style="font-size:11px;color:#666">${esc(p.sub)}</div>` : ''}</div>`)
            .join('');
          const more = list.length > 8 ? `<div style="font-size:11px;color:#666">외 ${list.length - 8}건</div>` : '';
          Lf.marker([lat, lng], { icon }).bindPopup(`<div style="min-width:160px">${body}${more}</div>`).addTo(layerRef.current);
          bounds.push([lat, lng]);
        });
        if (bounds.length === 1) mapRef.current.setView(bounds[0], 13);
        else if (bounds.length > 1) mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        else mapRef.current.setView([36.5, 127.8], 7);
        setTimeout(() => mapRef.current?.invalidateSize(), 50);
      })
      .catch((e: Error) => onError?.(e.message));
    return () => {
      alive = false;
    };
  }, [points, color, onError]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    [],
  );

  return <div ref={elRef} className="h-[420px] w-full overflow-hidden rounded-3xl border border-hairline" />;
}

// ───────────────────────── 카카오맵 ─────────────────────────
const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

type KakaoNS = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let kakaoPromise: Promise<KakaoNS> | null = null;

// 카카오 SDK는 앱 전체에서 딱 한 번만 불러오고, 그 약속(Promise)을 모두가 같이 쓴다.
// (예전에는 스크립트가 이미 로드된 뒤 다시 부르면 완료 신호를 영영 못 받아 지도가 빈 채로 남았다.)
function loadKakao(): Promise<KakaoNS> {
  if (kakaoPromise) return kakaoPromise;
  const w = window as unknown as { kakao?: KakaoNS };
  kakaoPromise = new Promise((resolve, reject) => {
    const fail = (msg: string) => {
      kakaoPromise = null; // 다음에 다시 시도할 수 있게 비운다
      document.querySelector('script[data-kakao-sdk]')?.remove();
      reject(new Error(msg));
    };
    const ready = () => {
      const k = (window as unknown as { kakao?: KakaoNS }).kakao;
      if (!k?.maps?.load) return fail('카카오맵 스크립트는 받았지만 지도 기능이 열리지 않았어요. 키 종류(JavaScript 키)와 "카카오맵 사용 설정"을 확인해 주세요.');
      k.maps.load(() => resolve(k));
    };
    const timer = setTimeout(
      () => fail('카카오맵 응답이 없어요. 키, 허용 도메인(http://localhost:3000), 카카오맵 사용 설정을 확인해 주세요.'),
      10000,
    );
    if (w.kakao?.maps?.load) {
      clearTimeout(timer);
      return ready();
    }
    const s = document.createElement('script');
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false`;
    s.async = true;
    s.setAttribute('data-kakao-sdk', '1');
    s.onload = () => {
      clearTimeout(timer);
      ready();
    };
    s.onerror = () => {
      clearTimeout(timer);
      fail('카카오맵을 불러오지 못했어요. 키와 허용 도메인(http://localhost:3000), 광고 차단 확장 프로그램을 확인해 주세요.');
    };
    document.body.appendChild(s);
  });
  return kakaoPromise;
}

function KakaoMapView({ points, color = '#b4532a', onError }: { points: MapPoint[]; color?: string; onError?: (m: string) => void }) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoNS>(null);
  const overlaysRef = useRef<KakaoNS[]>([]);
  const openRef = useRef<KakaoNS>(null);

  useEffect(() => {
    let alive = true;
    loadKakao()
      .then((kakao) => {
        if (!alive || !elRef.current) return;
        if (!mapRef.current) {
          mapRef.current = new kakao.maps.Map(elRef.current, { center: new kakao.maps.LatLng(36.5, 127.8), level: 13 });
          mapRef.current.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
        }
        overlaysRef.current.forEach((o) => o.setMap(null));
        overlaysRef.current = [];
        openRef.current?.setMap(null);

        const groups = new Map<string, MapPoint[]>();
        for (const p of points) {
          const k = `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
          groups.set(k, [...(groups.get(k) ?? []), p]);
        }
        const bounds = new kakao.maps.LatLngBounds();
        groups.forEach((list) => {
          const pos = new kakao.maps.LatLng(list[0].lat, list[0].lng);
          const pin = document.createElement('div');
          pin.style.cssText = `width:34px;height:34px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font:700 13px sans-serif;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);cursor:pointer`;
          pin.textContent = String(list.length);
          const body = list
            .slice(0, 8)
            .map((p) => `<div style="margin:4px 0">${p.href ? `<a href="${esc(p.href)}" style="font-weight:600">${esc(p.title)}</a>` : `<b>${esc(p.title)}</b>`}${p.sub ? `<div style="font-size:11px;color:#666">${esc(p.sub)}</div>` : ''}</div>`)
            .join('');
          const more = list.length > 8 ? `<div style="font-size:11px;color:#666">외 ${list.length - 8}건</div>` : '';
          const card = document.createElement('div');
          card.style.cssText = 'background:#fff;border-radius:12px;padding:10px 12px;min-width:170px;box-shadow:0 4px 14px rgba(0,0,0,.25);font:13px sans-serif;position:relative;bottom:46px';
          card.innerHTML = body + more;
          pin.addEventListener('click', () => {
            openRef.current?.setMap(null);
            openRef.current = new kakao.maps.CustomOverlay({ position: pos, content: card, yAnchor: 1, zIndex: 10 });
            openRef.current.setMap(mapRef.current);
          });
          const ov = new kakao.maps.CustomOverlay({ position: pos, content: pin, yAnchor: 0.5 });
          ov.setMap(mapRef.current);
          overlaysRef.current.push(ov);
          bounds.extend(pos);
        });
        if (groups.size === 1) {
          const only = [...groups.values()][0][0];
          mapRef.current.setCenter(new kakao.maps.LatLng(only.lat, only.lng));
          mapRef.current.setLevel(5);
        } else if (groups.size > 1) mapRef.current.setBounds(bounds, 60, 60, 60, 60);
        else {
          mapRef.current.setCenter(new kakao.maps.LatLng(36.5, 127.8));
          mapRef.current.setLevel(13);
        }
        setTimeout(() => mapRef.current?.relayout(), 50);
      })
      .catch((e: Error) => onError?.(e.message));
    return () => {
      alive = false;
    };
  }, [points, color, onError]);

  return <div ref={elRef} className="h-[420px] w-full overflow-hidden rounded-3xl border border-hairline" />;
}

export function RegionMap(props: { points: MapPoint[]; color?: string; onError?: (m: string) => void }) {
  return KAKAO_KEY ? <KakaoMapView {...props} /> : <LeafletMap {...props} />;
}
