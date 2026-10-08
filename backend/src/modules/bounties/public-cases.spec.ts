import { BountiesService } from './bounties.service';
import { BountyStatus } from '../../common/enums/bounty-status.enum';
import { DomainType } from '../../common/enums/domain-type.enum';

/**
 * 공개 거래 사례(listPublicCases) — 성공만이 아니라 실패·보류도 공개하고,
 * 결과 구분(outcome)과 시스템/의뢰인 점수가 따로 내려가는지 검증한다.
 */
describe('BountiesService.listPublicCases', () => {
  const day = 86_400_000;
  const base = new Date('2026-09-01T00:00:00Z').getTime();
  const mk = (id: string, status: BountyStatus, days: number, extra: Record<string, unknown> = {}) => ({
    id,
    status,
    domainType: DomainType.VEHICLE_DIAGNOSTICS,
    assignedExpertId: 'e1',
    bountyAmount: '150000',
    createdAt: new Date(base),
    updatedAt: new Date(base + days * day),
    clientRating: null,
    clientRatingNote: null,
    ...extra,
  });

  function build(rows: any[], disputedBountyIds: string[]) {
    const svc = Object.create(BountiesService.prototype) as any;
    svc.bountyRepository = { find: jest.fn().mockResolvedValue(rows) };
    svc.dataSource = {
      getRepository: jest.fn().mockReturnValue({
        find: jest.fn().mockResolvedValue(disputedBountyIds.map((bountyId) => ({ bountyId }))),
      }),
    };
    svc.usersService = { findById: jest.fn().mockResolvedValue({ id: 'e1-uuid-0000', name: '이도현' }) };
    svc.reputationService = {
      getExpertReputation: jest.fn().mockResolvedValue({ score10: 7.5, completedCount: 4, refundedCount: 1 }),
    };
    return svc as BountiesService;
  }

  it('성공·분쟁 후 정산·환불·보류를 구분해 모두 내려준다', async () => {
    const svc = build(
      [
        mk('a', BountyStatus.SETTLED, 3, { clientRating: '9.0', clientRatingNote: '빠르고 정확' }),
        mk('b', BountyStatus.SETTLED, 12),
        mk('c', BountyStatus.REFUNDED, 8),
        mk('d', BountyStatus.DISPUTED, 5),
      ],
      ['b', 'c', 'd'],
    );
    const out = await svc.listPublicCases();
    expect(out.map((c) => [c.id, c.outcome])).toEqual([
      ['a', 'SUCCESS'],
      ['b', 'SUCCESS_AFTER_DISPUTE'],
      ['c', 'REFUNDED'],
      ['d', 'ON_HOLD'],
    ]);
  });

  it('시스템 점수(전문가 누적)와 의뢰인 점수(건별)는 따로 내려가고, 평가가 없으면 null이다', async () => {
    const svc = build([mk('a', BountyStatus.SETTLED, 3, { clientRating: '9.0' }), mk('b', BountyStatus.SETTLED, 12)], []);
    const [a, b] = await svc.listPublicCases();
    expect(a.systemScore).toBe(7.5);
    expect(a.clientRating).toBe(9);
    expect(b.systemScore).toBe(7.5);
    expect(b.clientRating).toBeNull();
    expect(a.expertCompletedCount).toBe(4);
    expect(a.expertRefundedCount).toBe(1);
  });

  it('처리 기간(일)은 등록~종결 시각 차이이고, 실명·정확한 금액은 응답에 없다', async () => {
    const svc = build([mk('a', BountyStatus.SETTLED, 14)], []);
    const [c] = await svc.listPublicCases();
    expect(c.durationDays).toBe(14);
    expect(c.amountBand).toBe('10만원~30만원');
    expect(JSON.stringify(c)).not.toContain('이도현');
    expect(JSON.stringify(c)).not.toContain('150000');
  });

  it('배정된 전문가가 없는 건은 제외한다', async () => {
    const svc = build([mk('a', BountyStatus.SETTLED, 1, { assignedExpertId: null })], []);
    expect(await svc.listPublicCases()).toEqual([]);
  });
});
