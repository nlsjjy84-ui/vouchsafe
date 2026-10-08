import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Bounty } from '../bounties/entities/bounty.entity';
import { Certification } from '../certifications/entities/certification.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { ReputationService } from '../users/reputation.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { BountyStatus } from '../../common/enums/bounty-status.enum';
import { VerificationStatus } from '../../common/enums/verification-track.enum';
import { DOMAIN_LABELS } from '../../common/enums/domain-type.enum';

export type ExpertOutcome = 'SUCCESS' | 'SUCCESS_AFTER_DISPUTE' | 'REFUNDED' | 'ON_HOLD';

const DAY = 86_400_000;
const PROFILE_ROLES = [UserRole.EXPERT, UserRole.HYBRID];

/** 정확한 금액 대신 구간만 공개한다(공개 거래 사례와 같은 기준). */
export function amountBand(amount: number): string {
  if (amount < 100_000) return '10만원 미만';
  if (amount < 300_000) return '10만원~30만원';
  if (amount < 500_000) return '30만원~50만원';
  if (amount < 1_000_000) return '50만원~100만원';
  if (amount < 3_000_000) return '100만원~300만원';
  return '300만원 이상';
}

/**
 * 전문가 공개 프로필. 한 화면에서 "이 사람을 믿어도 되는가"를 판단할 수 있게
 * 인증 분야 · 시스템 점수 · 처리 이력(성공/분쟁/환불) · 의뢰인 후기를 모아 보여준다.
 * 의뢰인의 이름·정확한 금액·위치는 절대 내려가지 않는다(전문가 쪽만 실명 공개).
 */
@Injectable()
export class ExpertsService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Bounty) private readonly bounties: Repository<Bounty>,
    @InjectRepository(Certification) private readonly certs: Repository<Certification>,
    @InjectRepository(Dispute) private readonly disputes: Repository<Dispute>,
    private readonly reputation: ReputationService,
  ) {}

  async getProfile(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new NotFoundException('전문가를 찾을 수 없습니다.');
    const user = await this.users.findOne({ where: { id } });
    if (!user || !PROFILE_ROLES.includes(user.role)) throw new NotFoundException('전문가를 찾을 수 없습니다.');

    const [rep, certs, rows] = await Promise.all([
      this.reputation.getExpertReputation(id),
      this.certs.find({ where: { userId: id, verifiedStatus: VerificationStatus.APPROVED } }),
      this.bounties.find({
        where: [
          { assignedExpertId: id, status: BountyStatus.SETTLED },
          { assignedExpertId: id, status: BountyStatus.REFUNDED },
          { assignedExpertId: id, status: BountyStatus.DISPUTED },
        ],
        order: { updatedAt: 'DESC' },
      }),
    ]);

    const disputed = rows.length
      ? new Set((await this.disputes.find({ where: { bountyId: In(rows.map((r) => r.id)) } })).map((d) => d.bountyId))
      : new Set<string>();

    const history = rows.map((b) => {
      const outcome: ExpertOutcome =
        b.status === BountyStatus.REFUNDED
          ? 'REFUNDED'
          : b.status === BountyStatus.DISPUTED
            ? 'ON_HOLD'
            : disputed.has(b.id)
              ? 'SUCCESS_AFTER_DISPUTE'
              : 'SUCCESS';
      return {
        id: b.id,
        domainType: b.domainType,
        domainLabel: DOMAIN_LABELS[b.domainType],
        outcome,
        durationDays: Math.max(0, Math.round((new Date(b.updatedAt).getTime() - new Date(b.createdAt).getTime()) / DAY)),
        amountBand: amountBand(Number(b.bountyAmount)),
        clientRating: b.clientRating !== null ? Number(b.clientRating) : null,
        clientRatingNote: b.clientRatingNote,
        settledAt: new Date(b.updatedAt).toISOString(),
      };
    });

    const outcomes = { success: 0, successAfterDispute: 0, refunded: 0, onHold: 0 };
    for (const h of history) {
      if (h.outcome === 'SUCCESS') outcomes.success++;
      else if (h.outcome === 'SUCCESS_AFTER_DISPUTE') outcomes.successAfterDispute++;
      else if (h.outcome === 'REFUNDED') outcomes.refunded++;
      else outcomes.onHold++;
    }

    const rated = history.filter((h) => h.clientRating !== null);
    const avgClientRating = rated.length
      ? Math.round((rated.reduce((s, h) => s + (h.clientRating as number), 0) / rated.length) * 10) / 10
      : null;

    // 분야별 완료 건수 (SETTLED만)
    const perDomain = new Map<string, { domainType: string; domainLabel: string; completed: number }>();
    for (const h of history) {
      if (h.outcome !== 'SUCCESS' && h.outcome !== 'SUCCESS_AFTER_DISPUTE') continue;
      const cur = perDomain.get(h.domainType) ?? { domainType: h.domainType, domainLabel: h.domainLabel, completed: 0 };
      cur.completed++;
      perDomain.set(h.domainType, cur);
    }

    const seen = new Set<string>();
    const verified = certs
      .filter((c) => (seen.has(c.domainType) ? false : (seen.add(c.domainType), true)))
      .map((c) => ({
        domainType: c.domainType,
        domainLabel: DOMAIN_LABELS[c.domainType],
        track: c.track,
        verifiedSince: c.createdAt,
        completed: perDomain.get(c.domainType)?.completed ?? 0,
      }));

    const regionText = [user.regionSido, user.regionSigungu, user.regionDong].filter(Boolean).join(' ');

    return {
      id: user.id,
      name: user.name,
      role: user.role,
      joinedAt: user.createdAt,
      region: regionText ? { text: regionText, sido: user.regionSido, sigungu: user.regionSigungu, dong: user.regionDong } : null,
      verifiedDomains: verified,
      reputation: {
        score10: rep.score10,
        hasEnoughData: rep.hasEnoughData,
        completedCount: rep.completedCount,
        refundedCount: rep.refundedCount,
        disputedCount: rep.disputedCount,
        completionRate: rep.completionRate,
        disputeWinCount: rep.disputeWinCount,
        disputeTotalCount: rep.disputeTotalCount,
        avgSettlementDays: rep.avgSettlementDays,
      },
      outcomes,
      avgClientRating,
      ratedCount: rated.length,
      reviews: rated.slice(0, 20).map((h) => ({
        id: h.id,
        domainLabel: h.domainLabel,
        rating: h.clientRating,
        note: h.clientRatingNote,
        outcome: h.outcome,
        settledAt: h.settledAt,
      })),
      recentCases: history.slice(0, 12),
    };
  }
}
