import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Bounty } from '../bounties/entities/bounty.entity';
import { Certification } from '../certifications/entities/certification.entity';
import { ReputationService } from '../users/reputation.service';
import { BountyStatus } from '../../common/enums/bounty-status.enum';
import { DomainType } from '../../common/enums/domain-type.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { VerificationStatus } from '../../common/enums/verification-track.enum';
import { GeocoderService } from './geocoder.service';
import { normalizeSido } from './region.util';
import { SetRegionDto } from './dto/set-region.dto';

export interface RegionFilter { sido?: string; sigungu?: string; dong?: string }
export interface RegionFacet { name: string; count: number; children: RegionFacet[] }

/** 지역 이름 모음 → 시도 > 시군구 > 동 건수 트리 (필터 드롭다운에 쓴다) */
export function buildFacets(rows: { sido: string; sigungu: string | null; dong: string | null }[]): RegionFacet[] {
  const root = new Map<string, RegionFacet>();
  const child = (parent: Map<string, RegionFacet> | RegionFacet, name: string): RegionFacet => {
    const list = parent instanceof Map ? parent : null;
    const arr = list ? null : (parent as RegionFacet).children;
    let node = list ? list.get(name) : arr!.find((c) => c.name === name);
    if (!node) {
      node = { name, count: 0, children: [] };
      if (list) list.set(name, node);
      else arr!.push(node);
    }
    return node;
  };
  for (const r of rows) {
    const a = child(root, r.sido);
    a.count++;
    if (r.sigungu) {
      const b = child(a, r.sigungu);
      b.count++;
      if (r.dong) child(b, r.dong).count++;
    }
  }
  const sort = (list: RegionFacet[]) => {
    list.sort((x, y) => y.count - x.count || x.name.localeCompare(y.name, 'ko'));
    list.forEach((n) => sort(n.children));
    return list;
  };
  return sort([...root.values()]);
}

@Injectable()
export class RegionsService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Bounty) private readonly bounties: Repository<Bounty>,
    @InjectRepository(Certification) private readonly certs: Repository<Certification>,
    private readonly reputation: ReputationService,
    private readonly geocoder: GeocoderService,
  ) {}

  private async resolve(dto: SetRegionDto) {
    const sido = normalizeSido(dto.sido);
    const sigungu = dto.sigungu?.trim() || null;
    const dong = dto.dong?.trim() || null;
    const g = await this.geocoder.locate(sido, sigungu, dong);
    return { sido, sigungu, dong, lat: g.lat, lng: g.lng, approximate: g.approximate };
  }

  async setMyRegion(userId: string, dto: SetRegionDto) {
    const r = await this.resolve(dto);
    await this.users.update({ id: userId }, { regionSido: r.sido, regionSigungu: r.sigungu, regionDong: r.dong, regionLat: r.lat, regionLng: r.lng });
    return r;
  }

  async clearMyRegion(userId: string) {
    await this.users.update({ id: userId }, { regionSido: null, regionSigungu: null, regionDong: null, regionLat: null, regionLng: null });
    return { cleared: true };
  }

  async getMyRegion(userId: string) {
    const u = await this.users.findOne({ where: { id: userId } });
    if (!u) throw new NotFoundException('사용자를 찾을 수 없습니다');
    return u.regionSido ? { sido: u.regionSido, sigungu: u.regionSigungu, dong: u.regionDong } : null;
  }

  async setBountyRegion(userId: string, bountyId: string, dto: SetRegionDto) {
    const b = await this.bounties.findOne({ where: { id: bountyId } }).catch(() => null);
    if (!b) throw new NotFoundException('프로젝트를 찾을 수 없습니다');
    if (b.clientId !== userId) throw new ForbiddenException('본인이 등록한 프로젝트만 지역을 설정할 수 있습니다');
    if (b.status !== BountyStatus.PENDING) throw new BadRequestException('모집 중인 프로젝트만 지역을 바꿀 수 있습니다');
    const r = await this.resolve(dto);
    await this.bounties.update({ id: bountyId }, { regionSido: r.sido, regionSigungu: r.sigungu, regionDong: r.dong, regionLat: r.lat, regionLng: r.lng });
    return r;
  }

  /** 지역 필터 드롭다운용: 지금 데이터에 실제로 있는 지역만 건수와 함께 */
  async facets(type: 'expert' | 'bounty'): Promise<RegionFacet[]> {
    if (type === 'bounty') {
      const rows = await this.bounties.find({ where: { status: BountyStatus.PENDING, regionSido: Not(IsNull()) }, select: ['regionSido', 'regionSigungu', 'regionDong'] });
      return buildFacets(rows.map((r) => ({ sido: r.regionSido!, sigungu: r.regionSigungu, dong: r.regionDong })));
    }
    const experts = await this.approvedExperts();
    return buildFacets(experts.map((u) => ({ sido: u.regionSido!, sigungu: u.regionSigungu, dong: u.regionDong })));
  }

  private async approvedExperts(): Promise<User[]> {
    const withRegion = await this.users.find({ where: { regionSido: Not(IsNull()) } });
    const ids = withRegion.map((u) => u.id);
    if (!ids.length) return [];
    const approved = await this.certs.find({ where: { userId: In(ids), verifiedStatus: VerificationStatus.APPROVED } });
    const ok = new Set(approved.map((c) => c.userId));
    return withRegion.filter((u) => ok.has(u.id) && u.role !== UserRole.ADMIN);
  }

  private matches(r: { regionSido: string | null; regionSigungu: string | null; regionDong: string | null }, f: RegionFilter) {
    if (f.sido && r.regionSido !== f.sido) return false;
    if (f.sigungu && r.regionSigungu !== f.sigungu) return false;
    if (f.dong && r.regionDong !== f.dong) return false;
    return true;
  }

  async listExperts(f: RegionFilter & { domain?: DomainType }) {
    const experts = (await this.approvedExperts()).filter((u) => this.matches(u, f));
    const certRows = experts.length
      ? await this.certs.find({ where: { userId: In(experts.map((e) => e.id)), verifiedStatus: VerificationStatus.APPROVED } })
      : [];
    const domainsBy = new Map<string, DomainType[]>();
    for (const c of certRows) {
      const l = domainsBy.get(c.userId) ?? [];
      if (!l.includes(c.domainType)) l.push(c.domainType);
      domainsBy.set(c.userId, l);
    }
    const items: Array<Record<string, any>> = [];
    for (const u of experts.slice(0, 200)) {
      const domains = domainsBy.get(u.id) ?? [];
      if (f.domain && !domains.includes(f.domain)) continue;
      const rep = await this.reputation.getExpertReputation(u.id);
      items.push({
        id: u.id,
        name: u.name,
        role: u.role,
        verifiedDomains: domains,
        completedCount: rep.completedCount,
        score10: rep.hasEnoughData ? rep.score10 : null,
        region: { sido: u.regionSido, sigungu: u.regionSigungu, dong: u.regionDong, lat: u.regionLat, lng: u.regionLng },
      });
    }
    items.sort((a, b) => (b.score10 ?? -1) - (a.score10 ?? -1) || b.completedCount - a.completedCount);
    return { items, total: items.length };
  }

  async listBounties(f: RegionFilter & { domain?: DomainType }) {
    const rows = await this.bounties.find({
      where: { status: BountyStatus.PENDING, regionSido: Not(IsNull()), ...(f.domain ? { domainType: f.domain } : {}) },
      order: { createdAt: 'DESC' },
      take: 300,
    });
    const items = rows.filter((b) => this.matches(b, f)).map((b) => ({
      id: b.id,
      title: b.title,
      domainType: b.domainType,
      amount: Number(b.bountyAmount),
      serviceType: b.serviceType,
      createdAt: b.createdAt,
      region: { sido: b.regionSido, sigungu: b.regionSigungu, dong: b.regionDong, lat: b.regionLat, lng: b.regionLng },
    }));
    return { items, total: items.length };
  }
}
