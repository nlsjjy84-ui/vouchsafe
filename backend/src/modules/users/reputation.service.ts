import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bounty } from '../bounties/entities/bounty.entity';
import { BountyStatus } from '../../common/enums/bounty-status.enum';
import { Dispute, DisputeStatus } from '../disputes/entities/dispute.entity';

export interface ExpertReputation {
  expertId: string;
  completedCount: number;
  disputedCount: number;
  completionRate: number; // 0~1
  disputeWinCount: number;
  disputeTotalCount: number;
  disputeWinRate: number; // 0~1
  durationScore: number; // 0~1 - 같은 도메인 평균 대비 이 전문가의 평균 처리 속도
  avgSettlementDays: number | null; // 참고용 - 등록~정산까지 평균 며칠 걸렸는지
  reputationScore: number; // 0~1 가중합
  score10: number; // 0~10, 0.5점 단위로 반올림한 "공개 사례"용 시스템 점수
  hasEnoughData: boolean; // SETTLED/DISPUTED 이력이 하나도 없으면 false
}

const COMPLETION_WEIGHT = 0.5;
const DISPUTE_WIN_WEIGHT = 0.25;
const DURATION_WEIGHT = 0.25;

/**
 * 전문가 평판 점수 = 완료율(50%) + 분쟁 승률(25%) + 처리속도(25%) 가중평균.
 *
 * 완료율: 배정받은 바운티(SETTLED 또는 DISPUTED로 끝난 것) 중 SETTLED로 끝난 비율.
 *   LOCKED/SUBMITTED처럼 아직 진행 중인 건은 "결과가 정해지지 않았으므로" 분모에서 뺀다.
 * 분쟁 승률: 이 전문가가 배정된 바운티에서 발생한 분쟁 중, 전문가 손을 들어준(RESOLVED_SETTLE)
 *   비율. 분쟁 이력이 아예 없으면 "패소한 적도 없다"는 의미로 1.0(만점)을 기본값으로 둔다 —
 *   분쟁이 없는 전문가가 분쟁에서 한 번 이긴 전문가보다 불리해지면 안 되기 때문.
 * 처리속도(2026-09-16 추가): "몇 시간/며칠 빨리 끝내면 가산점을 주자"는 요청을, 없는
 *   필드(예상 소요기간)를 지어내지 않고 실제로 존재하는 데이터만으로 구현한 것 -
 *   이 전문가의 평균 처리기간(등록createdAt ~ 정산updatedAt)을, 같은 도메인 전체
 *   전문가들의 평균 처리기간과 비교한다. 도메인 평균보다 빠르면 만점(1.0)에 가깝고,
 *   느릴수록 비율만큼 감점된다. 자기 신고나 사람이 매기는 값이 아니라 시스템에
 *   실제로 기록된 타임스탬프 차이라 조작할 수 없다.
 */
@Injectable()
export class ReputationService {
  constructor(
    @InjectRepository(Bounty)
    private readonly bountyRepository: Repository<Bounty>,
    @InjectRepository(Dispute)
    private readonly disputeRepository: Repository<Dispute>,
  ) {}

  async getExpertReputation(expertId: string): Promise<ExpertReputation> {
    const [settledCount, disputedCount] = await Promise.all([
      this.bountyRepository.count({
        where: { assignedExpertId: expertId, status: BountyStatus.SETTLED },
      }),
      this.bountyRepository.count({
        where: { assignedExpertId: expertId, status: BountyStatus.DISPUTED },
      }),
    ]);
    const decidedCount = settledCount + disputedCount;
    const completionRate = decidedCount > 0 ? settledCount / decidedCount : 0;

    // 이 전문가가 배정된 바운티들의 id를 먼저 구하고, 그 바운티들에 걸린 "해결된" 분쟁을 센다.
    const assignedBounties = await this.bountyRepository.find({
      where: { assignedExpertId: expertId },
      select: ['id'],
    });
    const bountyIds = assignedBounties.map((b) => b.id);

    let disputeWinCount = 0;
    let disputeTotalCount = 0;
    if (bountyIds.length > 0) {
      const disputes = await this.disputeRepository
        .createQueryBuilder('dispute')
        .where('dispute.bountyId IN (:...bountyIds)', { bountyIds })
        .andWhere('dispute.status IN (:...resolved)', {
          resolved: [DisputeStatus.RESOLVED_REFUND, DisputeStatus.RESOLVED_SETTLE],
        })
        .getMany();
      disputeTotalCount = disputes.length;
      disputeWinCount = disputes.filter((d) => d.status === DisputeStatus.RESOLVED_SETTLE).length;
    }
    const disputeWinRate = disputeTotalCount > 0 ? disputeWinCount / disputeTotalCount : 1;

    const { durationScore, avgSettlementDays } = await this.computeDurationScore(expertId);

    const reputationScore =
      completionRate * COMPLETION_WEIGHT +
      disputeWinRate * DISPUTE_WIN_WEIGHT +
      durationScore * DURATION_WEIGHT;

    return {
      expertId,
      completedCount: settledCount,
      disputedCount,
      completionRate,
      disputeWinCount,
      disputeTotalCount,
      disputeWinRate,
      durationScore,
      avgSettlementDays,
      reputationScore,
      score10: Math.max(0, Math.min(10, Math.round(reputationScore * 10 * 2) / 2)),
      hasEnoughData: decidedCount > 0,
    };
  }

  /**
   * 이 전문가의 평균 처리기간(등록~정산, ms)을 플랫폼 전체 SETTLED 바운티의 평균과 비교한다.
   * v1은 도메인별로 나누지 않고 플랫폼 전체 평균과 비교한다(도메인별 분리는 Phase 2 후보 -
   * 데이터가 충분히 쌓이기 전에는 도메인별 평균 자체의 표본이 너무 작아 오히려 왜곡될 수 있음).
   * 도메인 평균보다 빠르면 1.0(만점), 느리면 "도메인평균/내평균" 비율만큼 감점된다.
   */
  private async computeDurationScore(
    expertId: string,
  ): Promise<{ durationScore: number; avgSettlementDays: number | null }> {
    const expertSettled = await this.bountyRepository.find({
      where: { assignedExpertId: expertId, status: BountyStatus.SETTLED },
      select: ['createdAt', 'updatedAt'],
    });
    if (expertSettled.length === 0) {
      return { durationScore: 0, avgSettlementDays: null };
    }

    const platformSettled = await this.bountyRepository.find({
      where: { status: BountyStatus.SETTLED },
      select: ['createdAt', 'updatedAt'],
    });

    const durationMs = (b: { createdAt: Date; updatedAt: Date }) =>
      new Date(b.updatedAt).getTime() - new Date(b.createdAt).getTime();
    const avg = (list: number[]) => list.reduce((sum, v) => sum + v, 0) / list.length;

    const expertAvgMs = avg(expertSettled.map(durationMs));
    const platformAvgMs = avg(platformSettled.map(durationMs));

    const durationScore =
      platformAvgMs <= 0 || expertAvgMs <= 0
        ? 1
        : Math.min(1, platformAvgMs / expertAvgMs);

    return { durationScore, avgSettlementDays: expertAvgMs / (1000 * 60 * 60 * 24) };
  }
}
