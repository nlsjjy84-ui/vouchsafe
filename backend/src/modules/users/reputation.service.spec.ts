import { ReputationService } from './reputation.service';
import { BountyStatus } from '../../common/enums/bounty-status.enum';
import { DisputeStatus } from '../disputes/entities/dispute.entity';

/**
 * 유닛 테스트 — ReputationService.getExpertReputation()
 * 완료율(70%) + 분쟁승률(30%) 가중평균 계산이 정확한지, 트랜잭션 없이 순수 계산 로직만
 * 리포지토리를 mock으로 대체해 빠르게 검증한다.
 */
describe('ReputationService', () => {
  function buildService(opts: {
    settledCount: number;
    disputedCount: number;
    assignedBountyIds: string[];
    disputes: { status: DisputeStatus }[];
  }) {
    const bountyRepository = {
      count: jest.fn().mockImplementation(({ where }: { where: { status: BountyStatus } }) => {
        if (where.status === BountyStatus.SETTLED) return Promise.resolve(opts.settledCount);
        if (where.status === BountyStatus.DISPUTED) return Promise.resolve(opts.disputedCount);
        return Promise.resolve(0);
      }),
      find: jest.fn().mockResolvedValue(opts.assignedBountyIds.map((id) => ({ id }))),
    };
    const disputeRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(opts.disputes),
      }),
    };
    return new ReputationService(bountyRepository as any, disputeRepository as any);
  }

  it('이력이 전혀 없으면 hasEnoughData=false, completionRate=0', async () => {
    const service = buildService({
      settledCount: 0,
      disputedCount: 0,
      assignedBountyIds: [],
      disputes: [],
    });
    const result = await service.getExpertReputation('expert-1');
    expect(result.hasEnoughData).toBe(false);
    expect(result.completionRate).toBe(0);
  });

  it('분쟁 이력이 없으면 disputeWinRate는 기본값 1(패소 없음)이다', async () => {
    const service = buildService({
      settledCount: 5,
      disputedCount: 0,
      assignedBountyIds: ['b1', 'b2', 'b3', 'b4', 'b5'],
      disputes: [],
    });
    const result = await service.getExpertReputation('expert-1');
    expect(result.disputeWinRate).toBe(1);
    expect(result.completionRate).toBe(1);
  });

  it('완료율 100% + 분쟁 없음 → 평판 점수는 만점(1.0)', async () => {
    const service = buildService({
      settledCount: 3,
      disputedCount: 0,
      assignedBountyIds: ['b1', 'b2', 'b3'],
      disputes: [],
    });
    const result = await service.getExpertReputation('expert-1');
    expect(result.reputationScore).toBeCloseTo(1.0);
  });

  it('SETTLED 3건 + DISPUTED 1건이면 완료율은 3/4 = 0.75', async () => {
    const service = buildService({
      settledCount: 3,
      disputedCount: 1,
      assignedBountyIds: ['b1', 'b2', 'b3', 'b4'],
      disputes: [],
    });
    const result = await service.getExpertReputation('expert-1');
    expect(result.completionRate).toBeCloseTo(0.75);
  });

  it('분쟁 2건 중 1건 RESOLVED_SETTLE(전문가 승)이면 분쟁승률 0.5', async () => {
    const service = buildService({
      settledCount: 2,
      disputedCount: 2,
      assignedBountyIds: ['b1', 'b2', 'b3', 'b4'],
      disputes: [{ status: DisputeStatus.RESOLVED_SETTLE }, { status: DisputeStatus.RESOLVED_REFUND }],
    });
    const result = await service.getExpertReputation('expert-1');
    expect(result.disputeWinRate).toBeCloseTo(0.5);
  });

  it('가중평균 공식이 정확히 completionRate*0.7 + disputeWinRate*0.3 이다', async () => {
    // 완료율 0.75, 분쟁승률 0.5 → 0.75*0.7 + 0.5*0.3 = 0.525 + 0.15 = 0.675
    const service = buildService({
      settledCount: 3,
      disputedCount: 1,
      assignedBountyIds: ['b1', 'b2', 'b3', 'b4'],
      disputes: [{ status: DisputeStatus.RESOLVED_SETTLE }, { status: DisputeStatus.RESOLVED_REFUND }],
    });
    const result = await service.getExpertReputation('expert-1');
    expect(result.reputationScore).toBeCloseTo(0.675);
  });
});
