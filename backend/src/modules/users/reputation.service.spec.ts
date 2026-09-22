import { ReputationService } from './reputation.service';
import { BountyStatus } from '../../common/enums/bounty-status.enum';
import { DisputeStatus } from '../disputes/entities/dispute.entity';

/**
 * 유닛 테스트 — ReputationService.getExpertReputation()
 * 완료율(50%) + 분쟁승률(25%) + 처리속도(25%) 가중평균 계산이 정확한지, 트랜잭션 없이
 * 순수 계산 로직만 리포지토리를 mock으로 대체해 빠르게 검증한다.
 *
 * (2026-09-23 버그 수정) 처리속도(durationScore) 계산 로직(computeDurationScore)이
 * 2026-09-16에 추가되면서 bountyRepository.find()가 3가지 다른 용도(배정 프로젝트 id 목록 /
 * 전문가의 SETTLED 날짜들 / 플랫폼 전체 SETTLED 날짜들)로 호출되게 됐는데, 기존 mock은
 * find()를 어떤 용도로 부르든 항상 같은 값(id만 있고 createdAt/updatedAt이 없는 객체)을
 * 반환해서 durationScore 계산 중 new Date(undefined).getTime()이 NaN이 되고, 그 NaN이
 * reputationScore 전체를 오염시키고 있었다(완료율/분쟁승률만 확인하는 테스트는 우연히
 * 통과했지만, reputationScore를 직접 확인하는 두 테스트는 실패). 완료율/분쟁승률 가중치
 * 검증에는 처리속도 계산 자체가 중요하지 않으므로, 여기서는 computeDurationScore를
 * 고정값으로 스텁해 관심사를 분리한다. 실제 날짜 기반 계산은 아래 별도 테스트에서
 * end-to-end로 검증한다.
 */
describe('ReputationService', () => {
  function buildService(opts: {
    settledCount: number;
    disputedCount: number;
    assignedBountyIds: string[];
    disputes: { status: DisputeStatus }[];
    durationScore?: number;
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
    const service = new ReputationService(bountyRepository as any, disputeRepository as any);
    // 처리속도 계산(computeDurationScore)은 별도 테스트에서 실제 날짜로 검증하므로,
    // 여기서는 완료율/분쟁승률 가중치만 순수하게 검증하기 위해 고정값으로 스텁한다.
    jest.spyOn(service as any, 'computeDurationScore').mockResolvedValue({
      durationScore: opts.durationScore ?? 0,
      avgSettlementDays: null,
    });
    return service;
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

  it('완료율 100% + 분쟁 없음 + 처리속도 만점 → 평판 점수는 만점(1.0)', async () => {
    const service = buildService({
      settledCount: 3,
      disputedCount: 0,
      assignedBountyIds: ['b1', 'b2', 'b3'],
      disputes: [],
      durationScore: 1,
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

  it('가중평균 공식이 정확히 completionRate*0.5 + disputeWinRate*0.25 + durationScore*0.25 이다', async () => {
    // 완료율 0.75, 분쟁승률 0.5, 처리속도 0.6
    // → 0.75*0.5 + 0.5*0.25 + 0.6*0.25 = 0.375 + 0.125 + 0.15 = 0.65
    const service = buildService({
      settledCount: 3,
      disputedCount: 1,
      assignedBountyIds: ['b1', 'b2', 'b3', 'b4'],
      disputes: [{ status: DisputeStatus.RESOLVED_SETTLE }, { status: DisputeStatus.RESOLVED_REFUND }],
      durationScore: 0.6,
    });
    const result = await service.getExpertReputation('expert-1');
    expect(result.reputationScore).toBeCloseTo(0.65);
  });

  it('처리속도(durationScore)가 실제 날짜로 계산되고, 어떤 경우에도 NaN이 되지 않는다', async () => {
    // 이 테스트는 computeDurationScore를 스텁하지 않고 실제로 실행시켜서,
    // bountyRepository.find()가 용도별(배정 id 목록 / 전문가 SETTLED 날짜 / 플랫폼 전체
    // SETTLED 날짜)로 다른 값을 받아야 한다는 걸 놓치면 바로 NaN으로 드러나게 한다 -
    // 오늘 고친 버그가 다시 생기면 이 테스트가 가장 먼저 잡아낸다.
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const expertSettledBounty = { createdAt: new Date(now - 2 * day), updatedAt: new Date(now) }; // 전문가: 2일 소요
    const platformSettledBounties = [
      { createdAt: new Date(now - 2 * day), updatedAt: new Date(now) }, // 2일
      { createdAt: new Date(now - 4 * day), updatedAt: new Date(now) }, // 4일 → 플랫폼 평균 3일
    ];

    const bountyRepository = {
      count: jest.fn().mockImplementation(({ where }: { where: { status: BountyStatus } }) => {
        if (where.status === BountyStatus.SETTLED) return Promise.resolve(1);
        if (where.status === BountyStatus.DISPUTED) return Promise.resolve(0);
        return Promise.resolve(0);
      }),
      find: jest.fn().mockImplementation(({ where, select }: { where: { assignedExpertId?: string; status?: BountyStatus }; select?: string[] }) => {
        if (select?.includes('createdAt')) {
          // computeDurationScore 호출: assignedExpertId가 있으면 "이 전문가의" SETTLED, 없으면 플랫폼 전체
          return Promise.resolve(where.assignedExpertId ? [expertSettledBounty] : platformSettledBounties);
        }
        // 배정 프로젝트 id 목록 조회 (select: ['id'])
        return Promise.resolve([{ id: 'b1' }]);
      }),
    };
    const disputeRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };
    const service = new ReputationService(bountyRepository as any, disputeRepository as any);

    const result = await service.getExpertReputation('expert-1');

    // 전문가 평균 2일 < 플랫폼 평균 3일(더 빠름) → min(1, 3/2) = 1.5 → 1로 캡
    expect(result.durationScore).toBe(1);
    expect(result.avgSettlementDays).toBeCloseTo(2);
    expect(Number.isNaN(result.reputationScore)).toBe(false);
  });
});
