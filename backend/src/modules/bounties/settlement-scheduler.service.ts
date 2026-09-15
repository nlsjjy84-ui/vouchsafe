import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BountiesService, NO_OBJECTION_PERIOD_DAYS } from './bounties.service';

/**
 * 기획서 8장 "SETTLED: 승인 또는 무이의 기간 만료 → 자동 정산 완료".
 * 매시 정각에 "SUBMITTED 상태로 5일이 지난" 바운티를 찾아 자동으로 정산한다.
 * BountiesService.approve()와 완전히 같은 정산 로직(settleSubmittedBounty)을 재사용해서
 * "수동 승인이든 자동 정산이든 결과가 달라지지 않는다"는 걸 코드 레벨에서 보장한다.
 *
 * 한 건이 실패해도(예: 정산 중 일시적 오류) 나머지 건 처리를 막지 않도록 개별로 try/catch한다 —
 * 배치 작업에서 "하나 실패하면 전체가 멈춘다"는 건 흔한 사고 패턴이라 의도적으로 막아뒀다.
 */
@Injectable()
export class SettlementSchedulerService {
  private readonly logger = new Logger(SettlementSchedulerService.name);

  constructor(private readonly bountiesService: BountiesService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleAutoSettlement(): Promise<void> {
    await this.runAutoSettlement();
  }

  /**
   * 실제 처리 로직. 크론 콜백과 관리자 수동 트리거(BountiesController) 양쪽에서 호출한다.
   * @returns 처리 결과 요약 (성공/실패 건수) — 관리자 수동 트리거 응답에 그대로 보여준다.
   */
  async runAutoSettlement(): Promise<{ processed: number; settled: number; failed: number }> {
    const candidates = await this.bountiesService.findSettleableSubmitted(
      NO_OBJECTION_PERIOD_DAYS,
    );
    let settled = 0;
    let failed = 0;

    for (const bounty of candidates) {
      try {
        await this.bountiesService.autoApprove(bounty.id);
        settled += 1;
        this.logger.log(`무이의 기간 만료 자동 정산 완료: bountyId=${bounty.id}`);
      } catch (err) {
        failed += 1;
        this.logger.error(
          `자동 정산 실패: bountyId=${bounty.id} — ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }

    if (candidates.length > 0) {
      this.logger.log(
        `자동 정산 배치 완료: 대상 ${candidates.length}건 중 성공 ${settled}건, 실패 ${failed}건`,
      );
    }
    return { processed: candidates.length, settled, failed };
  }
}
