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
  reputationScore: number; // 0~1, completionRate*0.7 + disputeWinRate*0.3
  hasEnoughData: boolean; // SETTLED/DISPUTED 이력이 하나도 없으면 false
}

const COMPLETION_WEIGHT = 0.7;
const DISPUTE_WIN_WEIGHT = 0.3;

/**
 * 전문가 평판 점수 = 완료율(70%) + 분쟁 승률(30%) 가중평균.
 *
 * 완료율: 배정받은 바운티(SETTLED 또는 DISPUTED로 끝난 것) 중 SETTLED로 끝난 비율.
 *   LOCKED/SUBMITTED처럼 아직 진행 중인 건은 "결과가 정해지지 않았으므로" 분모에서 뺀다.
 * 분쟁 승률: 이 전문가가 배정된 바운티에서 발생한 분쟁 중, 전문가 손을 들어준(RESOLVED_SETTLE)
 *   비율. 분쟁 이력이 아예 없으면 "패소한 적도 없다"는 의미로 1.0(만점)을 기본값으로 둔다 —
 *   분쟁이 없는 전문가가 분쟁에서 한 번 이긴 전문가보다 불리해지면 안 되기 때문.
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

    const reputationScore =
      completionRate * COMPLETION_WEIGHT + disputeWinRate * DISPUTE_WIN_WEIGHT;

    return {
      expertId,
      completedCount: settledCount,
      disputedCount,
      completionRate,
      disputeWinCount,
      disputeTotalCount,
      disputeWinRate,
      reputationScore,
      hasEnoughData: decidedCount > 0,
    };
  }
}
