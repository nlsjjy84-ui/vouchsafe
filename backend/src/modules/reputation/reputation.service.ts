import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bounty } from '../bounties/entities/bounty.entity';
import { Dispute, DisputeStatus } from '../disputes/entities/dispute.entity';
import { BountyStatus } from '../../common/enums/bounty-status.enum';
import { DomainType } from '../../common/enums/domain-type.enum';

export interface ReputationSummary {
  expertId: string;
  totalCompleted: number; // 정산까지 끝난(SETTLED) 거래 수
  totalConcluded: number; // 완전히 끝난 거래 수 (SETTLED + REFUNDED)
  completionRate: number | null; // 0~100, 이력이 아예 없으면 null
  disputesWon: number; // 분쟁 갔지만 전문가 손을 들어준 경우
  disputesLost: number; // 분쟁 갔고 의뢰인에게 환불된 경우 (전문가 귀책)
  domainBreakdown: Partial<Record<DomainType, number>>; // 도메인별 완료 건수
  reputationScore: number | null; // 0~100 종합 점수, 이력 없으면 null
}

/**
 * =========================================================================
 * ReputationService — 확장 기획 4장 "평판의 자산화" 구현
 * =========================================================================
 * "단순 평점이 아닌, 거래 완료율, 분쟁 승패 이력, 전문 도메인별 기여도를
 * 복합 반영한 신뢰도 점수 시스템"을 만든다.
 *
 * 왜 사용자가 직접 별점을 매기는 방식이 아니라 "거래 기록에서 자동 계산"하는가?
 * 이 플랫폼은 고관여·고액 거래를 다루기 때문에, 주관적인 별점보다 "실제로 몇 건을
 * 완료했고, 분쟁이 났을 때 전문가 책임으로 판정된 게 몇 건인가"라는 객관적 사실이
 * 훨씬 신뢰도가 높다. 데이터는 이미 Bounty/Dispute 테이블에 전부 있으므로, 이
 * 서비스는 새로 뭔가를 저장하지 않고 매 요청마다 "계산"만 한다 (조회 시점 실시간
 * 집계 — 나중에 트래픽이 커지면 캐싱을 고려할 수 있지만 지금 단계에서는 과설계).
 *
 * 점수 공식 (reputationScore, 0~100):
 *   기본은 완료율(completionRate)을 그대로 쓴다.
 *   분쟁 이력이 하나라도 있으면, "분쟁까지 갔을 때 전문가 책임으로 판정된 비율"을
 *   30% 가중치로 반영해서 깎는다 — 완료율은 높아도 분쟁에서 자주 지는 전문가라면
 *   신뢰도가 낮아야 하기 때문이다.
 * =========================================================================
 */
@Injectable()
export class ReputationService {
  constructor(
    @InjectRepository(Bounty)
    private readonly bountyRepository: Repository<Bounty>,
    @InjectRepository(Dispute)
    private readonly disputeRepository: Repository<Dispute>,
  ) {}

  async getSummary(expertId: string): Promise<ReputationSummary> {
    const [totalCompleted, totalRefunded, domainRows, disputesWon, disputesLost] =
      await Promise.all([
        this.bountyRepository.count({
          where: { assignedExpertId: expertId, status: BountyStatus.SETTLED },
        }),
        this.bountyRepository.count({
          where: { assignedExpertId: expertId, status: BountyStatus.REFUNDED },
        }),
        this.bountyRepository
          .createQueryBuilder('bounty')
          .select('bounty.domainType', 'domainType')
          .addSelect('COUNT(*)', 'count')
          .where('bounty.assignedExpertId = :expertId', { expertId })
          .andWhere('bounty.status = :status', { status: BountyStatus.SETTLED })
          .groupBy('bounty.domainType')
          .getRawMany<{ domainType: DomainType; count: string }>(),
        this.countDisputesByOutcome(expertId, DisputeStatus.RESOLVED_SETTLE),
        this.countDisputesByOutcome(expertId, DisputeStatus.RESOLVED_REFUND),
      ]);

    const totalConcluded = totalCompleted + totalRefunded;
    const completionRate = totalConcluded === 0 ? null : (totalCompleted / totalConcluded) * 100;

    const domainBreakdown: Partial<Record<DomainType, number>> = {};
    for (const row of domainRows) {
      domainBreakdown[row.domainType] = Number(row.count);
    }

    const reputationScore = this.computeScore(completionRate, disputesWon, disputesLost);

    return {
      expertId,
      totalCompleted,
      totalConcluded,
      completionRate: completionRate === null ? null : Math.round(completionRate * 10) / 10,
      disputesWon,
      disputesLost,
      domainBreakdown,
      reputationScore,
    };
  }

  /** 이 전문가가 배정됐던 바운티들 중, 분쟁이 특정 결과(승/패)로 끝난 건수 */
  private async countDisputesByOutcome(
    expertId: string,
    outcome: DisputeStatus,
  ): Promise<number> {
    return this.disputeRepository
      .createQueryBuilder('dispute')
      .innerJoin('dispute.bounty', 'bounty')
      .where('bounty.assignedExpertId = :expertId', { expertId })
      .andWhere('dispute.status = :outcome', { outcome })
      .getCount();
  }

  private computeScore(
    completionRate: number | null,
    disputesWon: number,
    disputesLost: number,
  ): number | null {
    if (completionRate === null) {
      return null; // 완료한 거래가 하나도 없으면 아직 점수를 매길 근거가 없다
    }

    const totalDisputes = disputesWon + disputesLost;
    if (totalDisputes === 0) {
      return Math.round(completionRate * 10) / 10;
    }

    const disputeWinRate = (disputesWon / totalDisputes) * 100;
    // 완료율 70% + 분쟁 승률 30% 가중 평균
    const score = completionRate * 0.7 + disputeWinRate * 0.3;
    return Math.round(score * 10) / 10;
  }
}
