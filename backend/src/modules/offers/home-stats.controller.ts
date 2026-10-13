import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bounty } from '../bounties/entities/bounty.entity';
import { BountyStatus } from '../../common/enums/bounty-status.enum';
import { DomainType } from '../../common/enums/domain-type.enum';
import { OffersService, median } from './offers.service';
import { ExpertOffer, OfferStatus } from './entities/expert-offer.entity';
import { calculatePlatformFee } from '../../mocks/settlement-fee.util';

/** 크몽 표시 수수료(16.4% + 결제망 3.3%, 부가세 별도) — 크몽 전문가센터 판매 수수료 정책(2024-08-20) 기준 */
export const KMONG_RATE = 0.197;

/**
 * 첫 화면 숫자 (GET /api/stats/home, 로그인 불필요).
 * 글보다 숫자를 먼저 보여 주기 위한 집계: 검증된 전문가, 정산까지 끝난 거래와 금액,
 * 최근 6개월 월별 정산, 분야별 거래, 상품 수, 15만 원 거래 기준 수수료 비교.
 * 개인 정보(이름·금액 원본)는 내보내지 않는다.
 */
@ApiTags('stats')
@Controller('stats')
export class HomeStatsController {
  constructor(
    private readonly offers: OffersService,
    @InjectRepository(Bounty) private readonly bounties: Repository<Bounty>,
    @InjectRepository(ExpertOffer) private readonly offerRepo: Repository<ExpertOffer>,
  ) {}

  @Get('home')
  async home() {
    const [trust, settled, byDomainRows, monthlyRows, activeOffers] = await Promise.all([
      this.offers.trust(),
      this.bounties
        .createQueryBuilder('b')
        .select('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(b.bountyAmount), 0)', 'amount')
        .where('b.status = :s', { s: BountyStatus.SETTLED })
        .getRawOne<{ count: string; amount: string }>(),
      this.bounties
        .createQueryBuilder('b')
        .select('b.domainType', 'domainType')
        .addSelect('COUNT(*)', 'count')
        .where('b.status IN (:...done)', { done: [BountyStatus.SETTLED, BountyStatus.LOCKED, BountyStatus.SUBMITTED] })
        .groupBy('b.domainType')
        .getRawMany<{ domainType: DomainType; count: string }>(),
      this.bounties
        .createQueryBuilder('b')
        .select("to_char(date_trunc('month', b.updatedAt), 'YYYY-MM')", 'month')
        .addSelect('COUNT(*)', 'count')
        .where('b.status = :s', { s: BountyStatus.SETTLED })
        .andWhere("b.updatedAt >= date_trunc('month', now()) - interval '5 months'")
        .groupBy('1')
        .orderBy('1')
        .getRawMany<{ month: string; count: string }>(),
      this.offerRepo.find({ where: { status: OfferStatus.ACTIVE }, select: ['id', 'price'] }),
    ]);

    // 최근 6개월을 빈 달까지 채운다(그래프에 빈칸이 생기지 않게)
    const months: { month: string; settled: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      months.push({ month: key, settled: Number(monthlyRows.find((r) => r.month === key)?.count ?? 0) });
    }

    const sample = 150_000;
    return {
      trust,
      settled: { count: Number(settled?.count ?? 0), amount: Number(settled?.amount ?? 0), refunded: trust.refundedDeals },
      months,
      byDomain: byDomainRows.map((r) => ({ domainType: r.domainType, count: Number(r.count) })),
      offers: { active: activeOffers.length, medianPrice: median(activeOffers.map((o) => Number(o.price))) },
      fee: { sample, vouchsafe: calculatePlatformFee(sample), kmong: Math.round(sample * KMONG_RATE) },
    };
  }
}
