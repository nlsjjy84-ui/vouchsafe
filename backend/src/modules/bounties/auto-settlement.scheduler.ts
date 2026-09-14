import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BountiesService } from './bounties.service';

const DEFAULT_AUTO_SETTLE_DAYS = 5;

/**
 * =========================================================================
 * AutoSettlementScheduler — "먹튀 및 악의적 거부 방어" 자동화 배치
 * =========================================================================
 * 확장 기획 4장: "요구사항을 충족했음에도 의뢰인이 무단으로 거부하는 경우
 * 일정 기간(예: 3일~7일) 내 합당한 이의 제기가 없으면 자동 정산 처리되는
 * 구조를 갖춘다"에 대응하는 구현.
 *
 * 왜 필요한가? 에스크로 구조에서 전문가를 가장 불안하게 만드는 시나리오는
 * "결과물을 다 냈는데 의뢰인이 그냥 아무 반응 없이 잠수타는 것"이다. 승인도
 * 이의제기도 안 하면 전문가는 영원히 돈을 못 받는 상태로 방치된다. 이 스케줄러가
 * 그 공백을 메운다: 일정 기간이 지나면 "의뢰인이 별말 없었다 = 결과물에 문제
 * 없다고 간주" 하고 시스템이 대신 정산을 완료시킨다.
 *
 * 실제 판단/정산 로직은 전부 BountiesService.runAutoSettlementSweep()에 있고,
 * 이 클래스는 "언제 실행할지"만 책임진다 (관리자가 수동으로 즉시 실행해보고
 * 싶을 때는 BountiesController의 관리자 전용 API가 같은 메서드를 호출한다).
 *
 * @Cron(CronExpression.EVERY_HOUR): 매시 정각에 한 번씩 실행. 실시간으로 초 단위
 * 정밀하게 감시할 필요는 없는 배치 작업이라(기준이 "일" 단위) 1시간 주기면 충분하다.
 * =========================================================================
 */
@Injectable()
export class AutoSettlementScheduler {
  constructor(private readonly bountiesService: BountiesService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredSubmissions(): Promise<void> {
    const cutoffDays = Number(process.env.AUTO_SETTLE_DAYS ?? DEFAULT_AUTO_SETTLE_DAYS);
    await this.bountiesService.runAutoSettlementSweep(cutoffDays);
  }
}
