import { Injectable, Logger } from '@nestjs/common';
import { SIDO_CENTER } from './region.util';

export interface LatLng { lat: number; lng: number }

/**
 * 시/군/구/동 → 대략적인 좌표. KAKAO_REST_KEY(카카오 REST API 키, 서버 .env)가 있으면 카카오 로컬 API를,
 * 없으면 무료 OpenStreetMap Nominatim(키 불필요)을 쓴다. Nominatim은 동 단위 정확도가 낮다.
 * 실패하거나 오래 걸리면 시도 대표 좌표로 대체한다 — 지도가 비는 것보다 낫지만 정확한 위치는 아니다.
 * 실서비스에서는 카카오 로컬 API 등으로 교체하면 되고, 호출부는 이 서비스 하나만 바라본다.
 */
@Injectable()
export class GeocoderService {
  private readonly logger = new Logger(GeocoderService.name);

  async locate(sido: string, sigungu?: string | null, dong?: string | null): Promise<LatLng & { approximate: boolean }> {
    const queries = [
      [sido, sigungu, dong].filter(Boolean).join(' '),
      [sido, sigungu].filter(Boolean).join(' '),
    ].filter((q, i, a) => q && a.indexOf(q) === i);
    for (const q of queries) {
      const hit = (process.env.KAKAO_REST_KEY ? await this.kakao(q) : null) ?? (await this.nominatim(q));
      if (hit) return { ...hit, approximate: false };
    }
    const c = SIDO_CENTER[sido];
    if (c) return { lat: c[0], lng: c[1], approximate: true };
    return { lat: 36.5, lng: 127.8, approximate: true };
  }

  private async kakao(q: string): Promise<LatLng | null> {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 4000);
      const headers = { Authorization: `KakaoAK ${process.env.KAKAO_REST_KEY}` };
      // 동 이름은 '주소'가 아니라 '장소/행정구역'으로 잡히는 경우가 많아 키워드 검색을 쓴다
      const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?size=1&query=${encodeURIComponent(q)}`, { signal: ctl.signal, headers });
      clearTimeout(timer);
      if (!res.ok) return null;
      const data = (await res.json()) as { documents?: { x: string; y: string }[] };
      const d = data.documents?.[0];
      if (!d) return null;
      const lat = Number(d.y), lng = Number(d.x);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    } catch (e) {
      this.logger.warn(`카카오 지오코딩 실패(${q}): ${(e as Error).message}`);
      return null;
    }
  }

  private async nominatim(q: string): Promise<LatLng | null> {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 4000);
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&accept-language=ko&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'Vouchsafe-portfolio-demo/1.0' } });
      clearTimeout(timer);
      if (!res.ok) return null;
      const data = (await res.json()) as { lat: string; lon: string }[];
      if (!data.length) return null;
      const lat = Number(data[0].lat), lng = Number(data[0].lon);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    } catch (e) {
      this.logger.warn(`지오코딩 실패(${q}): ${(e as Error).message}`);
      return null;
    }
  }
}
