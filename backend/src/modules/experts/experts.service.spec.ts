import { NotFoundException } from '@nestjs/common';
import { ExpertsService, amountBand } from './experts.service';
import { BountyStatus } from '../../common/enums/bounty-status.enum';
import { DomainType } from '../../common/enums/domain-type.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { VerificationStatus, VerificationTrack } from '../../common/enums/verification-track.enum';

describe('ExpertsService.getProfile', () => {
  const day = 86_400_000;
  const base = new Date('2026-09-01T00:00:00Z').getTime();
  const ID = '11111111-1111-1111-1111-111111111111';
  const b = (id: string, status: BountyStatus, days: number, extra: Record<string, unknown> = {}) => ({
    id,
    status,
    domainType: DomainType.VEHICLE_DIAGNOSTICS,
    bountyAmount: '250000',
    createdAt: new Date(base),
    updatedAt: new Date(base + days * day),
    clientRating: null,
    clientRatingNote: null,
    ...extra,
  });

  function build(user: any, rows: any[], disputedIds: string[] = [], certs: any[] = []) {
    return new ExpertsService(
      { findOne: jest.fn().mockResolvedValue(user) } as any,
      { find: jest.fn().mockResolvedValue(rows) } as any,
      { find: jest.fn().mockResolvedValue(certs) } as any,
      { find: jest.fn().mockResolvedValue(disputedIds.map((bountyId) => ({ bountyId }))) } as any,
      {
        getExpertReputation: jest.fn().mockResolvedValue({
          score10: 8, hasEnoughData: true, completedCount: 2, refundedCount: 1, disputedCount: 0,
          completionRate: 0.66, disputeWinCount: 1, disputeTotalCount: 1, avgSettlementDays: 4,
        }),
      } as any,
    );
  }
  const expert = { id: ID, name: '이도현', role: UserRole.EXPERT, createdAt: new Date(base), regionSido: '서울', regionSigungu: '성동구', regionDong: '성수동1가' };

  it('형식이 잘못된 id나 없는 사용자, 의뢰인 전용 계정은 404', async () => {
    await expect(build(null, []).getProfile('abc')).rejects.toBeInstanceOf(NotFoundException);
    await expect(build(null, []).getProfile(ID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(build({ ...expert, role: UserRole.CLIENT }, []).getProfile(ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('결과별 건수·평균 후기·인증 분야별 완료 건수를 계산하고 의뢰인 정보는 내려주지 않는다', async () => {
    const svc = build(
      expert,
      [
        b('a', BountyStatus.SETTLED, 3, { clientRating: '9.0', clientRatingNote: '정확했어요' }),
        b('b', BountyStatus.SETTLED, 6, { clientRating: '7.0' }),
        b('c', BountyStatus.SETTLED, 9),
        b('d', BountyStatus.REFUNDED, 4),
        b('e', BountyStatus.DISPUTED, 2),
      ],
      ['c', 'd'],
      [{ domainType: DomainType.VEHICLE_DIAGNOSTICS, track: VerificationTrack.BUSINESS, verifiedStatus: VerificationStatus.APPROVED, createdAt: new Date(base) }],
    );
    const p: any = await svc.getProfile(ID);
    expect(p.outcomes).toEqual({ success: 2, successAfterDispute: 1, refunded: 1, onHold: 1 });
    expect(p.avgClientRating).toBe(8);
    expect(p.ratedCount).toBe(2);
    expect(p.reviews).toHaveLength(2);
    expect(p.verifiedDomains[0].completed).toBe(3);
    expect(p.region.text).toBe('서울 성동구 성수동1가');
    expect(p.recentCases[0].amountBand).toBe('10만원~30만원');
    expect(JSON.stringify(p)).not.toMatch(/clientId|email|250000|lat|lng/);
  });

  it('후기가 하나도 없으면 평균은 null', async () => {
    const p: any = await build(expert, [b('a', BountyStatus.SETTLED, 3)]).getProfile(ID);
    expect(p.avgClientRating).toBeNull();
    expect(p.region).not.toBeNull();
  });

  it('금액은 구간으로만', () => {
    expect(amountBand(50_000)).toBe('10만원 미만');
    expect(amountBand(5_000_000)).toBe('300만원 이상');
  });
});
