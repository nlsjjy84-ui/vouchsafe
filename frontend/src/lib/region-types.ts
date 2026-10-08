import { DomainType } from './types';

export interface RegionFacet {
  name: string;
  count: number;
  children: RegionFacet[];
}

export interface RegionInfo {
  sido: string | null;
  sigungu: string | null;
  dong: string | null;
  lat: number | null;
  lng: number | null;
}

export interface RegionExpert {
  id: string;
  name: string;
  role: 'CLIENT' | 'EXPERT' | 'HYBRID' | 'ADMIN';
  verifiedDomains: DomainType[];
  completedCount: number;
  score10: number | null;
  region: RegionInfo;
}

export interface RegionBounty {
  id: string;
  title: string;
  domainType: DomainType;
  amount: number;
  serviceType: 'REMOTE' | 'COMPANION';
  createdAt: string;
  region: RegionInfo;
}

export interface PickedRegion {
  sido: string;
  sigungu: string;
  dong: string;
  address: string; // 화면 표시용 도로명/지번 주소 (서버에는 보내지 않는다)
}

export function regionLabel(r: { sido?: string | null; sigungu?: string | null; dong?: string | null }) {
  return [r.sido, r.sigungu, r.dong].filter(Boolean).join(' ');
}
