import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
import { ExpertOffer, OfferStatus } from './entities/expert-offer.entity';
import { OfferMessage } from './entities/offer-message.entity';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { OfferReport, ReportReason, ReportStatus } from './entities/offer-report.entity';
import { User } from '../users/entities/user.entity';
import { Certification } from '../certifications/entities/certification.entity';
import { VerificationStatus, VerificationTrack } from '../../common/enums/verification-track.enum';
import { Bounty } from '../bounties/entities/bounty.entity';
import { BountiesService } from '../bounties/bounties.service';
import { CertificationsService } from '../certifications/certifications.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DomainType, DOMAIN_LABELS } from '../../common/enums/domain-type.enum';
import { BountyStatus } from '../../common/enums/bounty-status.enum';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { ServiceType } from '../../common/enums/service-type.enum';
import { calculatePlatformFee, FEE_STEPS, MIN_DEAL_AMOUNT } from '../../mocks/settlement-fee.util';
import { RISK_META, RiskType, ruleBasedRisk } from '../ai/features/risk-check.feature';

/** 전문가 한 명이 동시에 열어 둘 수 있는 상품 수 — 목록이 한 사람 상품으로 도배되지 않게 */
export const MAX_ACTIVE_OFFERS = 5;
/** 상품을 연달아 올리지 못하게 하는 간격 */
export const OFFER_COOLDOWN_MS = 10 * 60_000;
/** 한 사람이 한 시간에 남길 수 있는 문의·답변 수(모든 상품 합계) */
export const MESSAGE_HOURLY_LIMIT = 20;
const HOUR_MS = 60 * 60_000;

/** 상품 카드에 붙는 인증 근거. 자격증 번호 같은 원문은 내보내지 않고 "어떤 길로 인증했는지"만 보여 준다. */
export const TRACK_LABELS: Record<VerificationTrack, string> = {
  [VerificationTrack.STANDARD]: '국가 공인 자격증',
  [VerificationTrack.BUSINESS]: '사업자 경력',
  [VerificationTrack.PROFESSIONAL_EDUCATOR]: '실무 경력·강의',
  [VerificationTrack.INFLUENCER_CREATOR]: '크리에이터 실적',
};

/**
 * 상품·문의에서 막는 표현. 경고만 하는 공고 점검과 달리, 상품 게시판은 누구나 읽으므로
 * 플랫폼 밖 거래·연락처·선입금 요구는 아예 올라가지 않게 한다(수수료를 피해 나가는 통로가 되지 않게).
 */
const BLOCKED: RiskType[] = ['OFF_PLATFORM', 'CONTACT', 'ADVANCE_PAYMENT'];

export function blockedReason(text: string): string | null {
  const hit = ruleBasedRisk(text).find((s) => BLOCKED.includes(s.type));
  if (!hit) return null;
  return `${RISK_META[hit.type].label}로 보이는 표현("${hit.quote}")은 올릴 수 없어요. ${hit.why}`;
}

export interface DomainAverage {
  domainType: DomainType;
  avg: number;
  count: number;
}

/** 이름 가리기: 김의뢰 → 김**. 후기는 공개되므로 실명을 다 보이지 않는다. */
export function maskName(name?: string | null): string {
  const n = (name ?? '').trim();
  if (!n) return '의뢰인';
  return n[0] + '*'.repeat(Math.max(1, Math.min(n.length - 1, 2)));
}

export const MAX_OFFER_IMAGES = 4;

/** 가운데 값. 몇 개 안 되는 비싼 상품에 평균이 끌려가지 않게 첫 화면 숫자는 중앙값을 쓴다. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(ExpertOffer) private readonly offers: Repository<ExpertOffer>,
    @InjectRepository(OfferMessage) private readonly messages: Repository<OfferMessage>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Bounty) private readonly bounties: Repository<Bounty>,
    @InjectRepository(Certification) private readonly certs: Repository<Certification>,
    @InjectRepository(OfferReport) private readonly reports: Repository<OfferReport>,
    private readonly bountiesService: BountiesService,
    private readonly certifications: CertificationsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** 이 사이트에서 분야별로 실제 의뢰된 금액 평균(완료·진행 건). 상품 가격 옆에 비교로 보여 준다. */
  async domainAverages(): Promise<Map<DomainType, DomainAverage>> {
    const rows: { domainType: DomainType; avg: string; count: string }[] = await this.bounties
      .createQueryBuilder('b')
      .select('b.domainType', 'domainType')
      .addSelect('AVG(b.bountyAmount)', 'avg')
      .addSelect('COUNT(*)', 'count')
      .where('b.status IN (:...done)', { done: [BountyStatus.LOCKED, BountyStatus.SUBMITTED, BountyStatus.SETTLED] })
      .groupBy('b.domainType')
      .getRawMany();
    return new Map(rows.map((r) => [r.domainType, { domainType: r.domainType, avg: Math.round(Number(r.avg)), count: Number(r.count) }]));
  }

  /**
   * "전문가 집단"이라는 근거 숫자: 인증을 통과한 전문가 수, 심사한 인증 중 통과한 비율.
   * 아무나 올리는 마켓이 아니라 심사를 거친 사람만 상품을 올린다는 것을 첫 화면에서 보여 준다.
   */
  async trust() {
    const rows: { status: VerificationStatus; count: string; users: string }[] = await this.certs
      .createQueryBuilder('c')
      .select('c.verifiedStatus', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COUNT(DISTINCT c.userId)', 'users')
      .groupBy('c.verifiedStatus')
      .getRawMany();
    const tracks: { track: VerificationTrack; users: string }[] = await this.certs
      .createQueryBuilder('c')
      .select('c.track', 'track')
      .addSelect('COUNT(DISTINCT c.userId)', 'users')
      .where('c.verifiedStatus = :ok', { ok: VerificationStatus.APPROVED })
      .groupBy('c.track')
      .getRawMany();
    const [settledDeals, refundedDeals] = await Promise.all([
      this.bounties.count({ where: { status: BountyStatus.SETTLED } }),
      this.bounties.count({ where: { status: BountyStatus.REFUNDED } }),
    ]);
    const by = (st: VerificationStatus) => rows.find((r) => r.status === st);
    const approved = Number(by(VerificationStatus.APPROVED)?.count ?? 0);
    const rejected = Number(by(VerificationStatus.REJECTED)?.count ?? 0);
    const reviewed = approved + rejected;
    return {
      verifiedExperts: Number(by(VerificationStatus.APPROVED)?.users ?? 0),
      reviewed,
      approved,
      rejected,
      pending: Number(by(VerificationStatus.PENDING)?.count ?? 0),
      passRate: reviewed > 0 ? Math.round((approved / reviewed) * 100) : null,
      settledDeals,
      refundedDeals,
      byTrack: tracks
        .map((t) => ({ track: t.track, label: TRACK_LABELS[t.track], experts: Number(t.users) }))
        .sort((a, b) => b.experts - a.experts),
    };
  }

  /** 상품별 후기 평균(10점 만점)과 개수 — 이 상품으로 들어와 정산이 끝난 의뢰에 의뢰인이 남긴 평가 */
  async offerRatings(offerIds: string[]): Promise<Map<string, { avg: number; count: number }>> {
    if (offerIds.length === 0) return new Map();
    const rows: { offerId: string; avg: string; count: string }[] = await this.bounties
      .createQueryBuilder('b')
      .select('b.sourceOfferId', 'offerId')
      .addSelect('AVG(b.clientRating)', 'avg')
      .addSelect('COUNT(*)', 'count')
      .where('b.sourceOfferId IN (:...ids)', { ids: offerIds })
      .andWhere('b.clientRating IS NOT NULL')
      .groupBy('b.sourceOfferId')
      .getRawMany();
    return new Map(rows.map((r) => [r.offerId, { avg: Math.round(Number(r.avg) * 10) / 10, count: Number(r.count) }]));
  }

  /** 상품마다 그 전문가가 그 분야를 어떤 길로 인증했는지 */
  private async verificationsFor(offers: ExpertOffer[]): Promise<Map<string, VerificationTrack>> {
    if (offers.length === 0) return new Map();
    const found = await this.certs.find({
      where: offers.map((o) => ({ userId: o.expertId, domainType: o.domainType, verifiedStatus: VerificationStatus.APPROVED })),
    });
    return new Map(found.map((c) => [`${c.userId}:${c.domainType}`, c.track]));
  }

  async list(filter: { domain?: DomainType; sort?: 'popular' | 'latest' | 'cheap' }) {
    const all = await this.offers.find({
      where: { status: OfferStatus.ACTIVE },
      relations: ['expert'],
      order: { createdAt: 'DESC' },
      take: 300,
    });
    const [averages, trust, tracks, ratings] = await Promise.all([
      this.domainAverages(),
      this.trust(),
      this.verificationsFor(all),
      this.offerRatings(all.map((o) => o.id)),
    ]);
    const shown = filter.domain ? all.filter((o) => o.domainType === filter.domain) : all;
    if (filter.sort === 'cheap') shown.sort((a, b) => Number(a.price) - Number(b.price));
    else if (filter.sort === 'popular') shown.sort((a, b) => b.orderCount + b.messageCount - (a.orderCount + a.messageCount));

    const byDomain = new Map<DomainType, number>();
    for (const o of all) byDomain.set(o.domainType, (byDomain.get(o.domainType) ?? 0) + 1);

    return {
      stats: {
        activeOffers: all.length,
        experts: new Set(all.map((o) => o.expertId)).size,
        medianPrice: median(all.map((o) => Number(o.price))),
        orders: all.reduce((sum, o) => sum + o.orderCount, 0),
        questions: all.reduce((sum, o) => sum + o.messageCount, 0),
        byDomain: [...byDomain.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([domainType, count]) => ({ domainType, label: DOMAIN_LABELS[domainType], count })),
      },
      trust,
      items: shown.map((o) => this.view(o, averages.get(o.domainType), tracks.get(`${o.expertId}:${o.domainType}`), ratings.get(o.id))),
      feeTable: { steps: FEE_STEPS, minDeal: MIN_DEAL_AMOUNT },
    };
  }

  async get(id: string) {
    const offer = await this.offers.findOne({ where: { id }, relations: ['expert'] });
    if (!offer) throw new NotFoundException('상품을 찾을 수 없습니다');
    const [averages, tracks, thread, completed, reviewRows, expertRated] = await Promise.all([
      this.domainAverages(),
      this.verificationsFor([offer]),
      this.messages.find({ where: { offerId: id }, relations: ['author'], order: { createdAt: 'ASC' }, take: 200 }),
      this.bounties.count({ where: { assignedExpertId: offer.expertId, status: BountyStatus.SETTLED } }),
      this.bounties.find({
        where: { sourceOfferId: id, clientRating: Not(IsNull()) },
        relations: ['client'],
        order: { updatedAt: 'DESC' },
        take: 50,
      }),
      // 이 전문가가 다른 거래(공고·다른 상품 포함)에서 받은 의뢰인 평가 — 상품 후기가 아직 없을 때의 근거
      this.bounties
        .createQueryBuilder('b')
        .select('AVG(b.clientRating)', 'avg')
        .addSelect('COUNT(*)', 'count')
        .where('b.assignedExpertId = :e', { e: offer.expertId })
        .andWhere('b.clientRating IS NOT NULL')
        .getRawOne<{ avg: string | null; count: string }>(),
    ]);
    const reviews = reviewRows.map((b) => ({
      id: b.id,
      rating: Number(b.clientRating),
      note: b.clientRatingNote,
      author: maskName(b.client?.name),
      settledAt: b.updatedAt,
    }));
    const rating = reviews.length
      ? { avg: Math.round((reviews.reduce((n, r) => n + r.rating, 0) / reviews.length) * 10) / 10, count: reviews.length }
      : undefined;
    return {
      ...this.view(offer, averages.get(offer.domainType), tracks.get(`${offer.expertId}:${offer.domainType}`), rating),
      description: offer.description,
      expertCompleted: completed,
      expertRating: expertRated && Number(expertRated.count) > 0
        ? { avg: Math.round(Number(expertRated.avg) * 10) / 10, count: Number(expertRated.count) }
        : null,
      reviews,
      messages: thread.map((m) => ({
        id: m.id,
        content: m.hiddenAt ? '관리자가 가린 문의예요.' : m.content,
        hidden: Boolean(m.hiddenAt),
        createdAt: m.createdAt,
        author: { id: m.authorId, name: m.author?.name ?? '탈퇴한 사용자' },
        isExpert: m.authorId === offer.expertId,
      })),
    };
  }

  /** 내 상품 관리: 닫은 것까지, 문의·의뢰·후기 숫자와 함께. */
  async mine(expertId: string) {
    const own = await this.offers.find({ where: { expertId }, relations: ['expert'], order: { createdAt: 'DESC' } });
    const ratings = await this.offerRatings(own.map((o) => o.id));
    const items = own.map((o) => this.view(o, undefined, undefined, ratings.get(o.id)));
    return {
      summary: {
        active: own.filter((o) => o.status === OfferStatus.ACTIVE).length,
        closed: own.filter((o) => o.status === OfferStatus.CLOSED).length,
        questions: own.reduce((n, o) => n + o.messageCount, 0),
        orders: own.reduce((n, o) => n + o.orderCount, 0),
        maxActive: MAX_ACTIVE_OFFERS,
      },
      items,
    };
  }

  private async ownOffer(userId: string, offerId: string): Promise<ExpertOffer> {
    const offer = await this.offers.findOne({ where: { id: offerId } });
    if (!offer || offer.expertId !== userId) throw new NotFoundException('상품을 찾을 수 없습니다');
    return offer;
  }

  /** 상품 수정. 바뀐 가격은 앞으로 들어오는 의뢰에만 적용된다(이미 만든 프로젝트 금액은 그대로). */
  async update(userId: string, offerId: string, dto: UpdateOfferDto) {
    const offer = await this.ownOffer(userId, offerId);
    const next = {
      title: dto.title?.trim() ?? offer.title,
      description: dto.description?.trim() ?? offer.description,
      area: dto.area !== undefined ? dto.area.trim() || null : offer.area,
    };
    const reason = blockedReason([next.title, next.description, next.area ?? ''].join('\n'));
    if (reason) throw new BadRequestException(reason);
    offer.title = next.title;
    offer.description = next.description;
    if (dto.price !== undefined) offer.price = dto.price;
    if (dto.days !== undefined) offer.days = dto.days;
    if (dto.serviceType !== undefined) offer.serviceType = dto.serviceType;
    offer.area = offer.serviceType === ServiceType.COMPANION ? next.area : null;
    return this.offers.save(offer);
  }

  /** 마감한 상품 다시 열기 — 열린 상품 5개 제한은 그대로 적용 */
  async reopen(userId: string, offerId: string) {
    const offer = await this.ownOffer(userId, offerId);
    if (offer.status === OfferStatus.ACTIVE) return offer;
    const active = await this.offers.count({ where: { expertId: userId, status: OfferStatus.ACTIVE } });
    if (active >= MAX_ACTIVE_OFFERS) {
      throw new BadRequestException(`열어 둘 수 있는 상품은 ${MAX_ACTIVE_OFFERS}개까지예요. 다른 상품을 먼저 마감해 주세요.`);
    }
    offer.status = OfferStatus.ACTIVE;
    return this.offers.save(offer);
  }

  async addImages(userId: string, offerId: string, urls: string[]) {
    const offer = await this.ownOffer(userId, offerId);
    const images = offer.images ?? [];
    if (images.length + urls.length > MAX_OFFER_IMAGES) {
      throw new BadRequestException(`사진은 상품 하나에 ${MAX_OFFER_IMAGES}장까지예요`);
    }
    offer.images = [...images, ...urls];
    return this.offers.save(offer);
  }

  async removeImage(userId: string, offerId: string, index: number) {
    const offer = await this.ownOffer(userId, offerId);
    const images = offer.images ?? [];
    if (!Number.isInteger(index) || index < 0 || index >= images.length) throw new NotFoundException('사진을 찾을 수 없습니다');
    offer.images = images.filter((_, i) => i !== index);
    return this.offers.save(offer);
  }

  async create(expertId: string, dto: CreateOfferDto) {
    const qualified = await this.certifications.hasApprovedCertification(expertId, dto.domainType);
    if (!qualified) {
      throw new ForbiddenException('이 분야의 자격 인증이 승인된 전문가만 상품을 올릴 수 있어요');
    }
    const active = await this.offers.count({ where: { expertId, status: OfferStatus.ACTIVE } });
    if (active >= MAX_ACTIVE_OFFERS) {
      throw new BadRequestException(`상품은 한 사람당 ${MAX_ACTIVE_OFFERS}개까지 열어 둘 수 있어요. 안 쓰는 상품을 닫고 올려 주세요.`);
    }
    const recent = await this.offers.findOne({ where: { expertId }, order: { createdAt: 'DESC' } });
    if (recent && Date.now() - new Date(recent.createdAt).getTime() < OFFER_COOLDOWN_MS) {
      throw new BadRequestException('상품은 10분에 하나씩 올릴 수 있어요');
    }
    const reason = blockedReason([dto.title, dto.description, dto.area ?? ''].join('\n'));
    if (reason) throw new BadRequestException(reason);

    const serviceType = dto.serviceType ?? ServiceType.REMOTE;
    return this.offers.save(
      this.offers.create({
        expertId,
        domainType: dto.domainType,
        title: dto.title.trim(),
        description: dto.description.trim(),
        price: dto.price,
        serviceType,
        area: serviceType === ServiceType.COMPANION ? dto.area?.trim() || null : null,
        days: dto.days ?? 3,
      }),
    );
  }

  async addMessage(userId: string, offerId: string, content: string) {
    const offer = await this.offers.findOne({ where: { id: offerId } });
    if (!offer) throw new NotFoundException('상품을 찾을 수 없습니다');
    if (offer.status !== OfferStatus.ACTIVE) throw new BadRequestException('닫힌 상품에는 문의를 남길 수 없어요');
    const text = content.trim();
    if (text.length < 2) throw new BadRequestException('두 글자 이상 적어 주세요');

    const since = new Date(Date.now() - HOUR_MS);
    const lastHour = await this.messages.count({ where: { authorId: userId, createdAt: MoreThan(since) } });
    if (lastHour >= MESSAGE_HOURLY_LIMIT) {
      throw new BadRequestException('문의는 한 시간에 20개까지 남길 수 있어요. 잠시 뒤에 다시 남겨 주세요.');
    }
    const same = await this.messages.findOne({ where: { offerId, authorId: userId, content: text, createdAt: MoreThan(since) } });
    if (same) throw new BadRequestException('같은 내용을 이미 남겼어요');
    const reason = blockedReason(text);
    if (reason) throw new BadRequestException(reason);

    const saved = await this.messages.save(this.messages.create({ offerId, authorId: userId, content: text }));
    await this.offers.increment({ id: offerId }, 'messageCount', 1);

    if (userId !== offer.expertId) {
      await this.notifications.notify(offer.expertId, NotificationType.OFFER_MESSAGE, `내 상품 「${offer.title}」에 새 문의가 왔어요.`);
    } else {
      // 전문가가 답하면, 그 상품에 문의를 남긴 사람들에게 알린다(최근 20명까지)
      const askers = await this.messages
        .createQueryBuilder('m')
        .select('DISTINCT m.authorId', 'authorId')
        .where('m.offerId = :offerId', { offerId })
        .andWhere('m.authorId != :expertId', { expertId: offer.expertId })
        .limit(20)
        .getRawMany();
      for (const a of askers) {
        await this.notifications.notify(a.authorId, NotificationType.OFFER_MESSAGE, `「${offer.title}」 전문가가 답변을 남겼어요.`);
      }
    }
    return saved;
  }

  async close(userId: string, offerId: string) {
    const offer = await this.ownOffer(userId, offerId);
    offer.status = OfferStatus.CLOSED;
    return this.offers.save(offer);
  }

  /** 이 가격으로 의뢰하기 — 프로젝트 생성 + 이 전문가 선택 + 결제 대기까지 한 번에. */
  async order(clientId: string, offerId: string, note?: string) {
    const offer = await this.offers.findOne({ where: { id: offerId } });
    if (!offer) throw new NotFoundException('상품을 찾을 수 없습니다');
    if (offer.status !== OfferStatus.ACTIVE) throw new BadRequestException('지금은 주문을 받지 않는 상품이에요');
    if (note) {
      const reason = blockedReason(note);
      if (reason) throw new BadRequestException(reason);
    }
    const bounty = await this.bountiesService.createFromOffer(clientId, offer, note);
    await this.offers.increment({ id: offerId }, 'orderCount', 1);
    return { bountyId: bounty.id, status: bounty.status };
  }

  /** 상품·문의 신고. 같은 사람은 같은 대상을 한 번만 신고할 수 있다. */
  async report(userId: string, offerId: string, reason: ReportReason, detail?: string, messageId?: string) {
    const offer = await this.offers.findOne({ where: { id: offerId } });
    if (!offer) throw new NotFoundException('상품을 찾을 수 없습니다');
    if (messageId) {
      const msg = await this.messages.findOne({ where: { id: messageId, offerId } });
      if (!msg) throw new NotFoundException('문의를 찾을 수 없습니다');
      if (msg.authorId === userId) throw new BadRequestException('내가 쓴 문의는 신고할 수 없어요');
    } else if (offer.expertId === userId) {
      throw new BadRequestException('내 상품은 신고할 수 없어요');
    }
    const targetKey = messageId ?? 'offer';
    const dup = await this.reports.findOne({ where: { reporterId: userId, offerId, targetKey } });
    if (dup) throw new BadRequestException('이미 신고했어요. 관리자가 확인하고 있어요.');
    await this.reports.save(
      this.reports.create({ offerId, messageId: messageId ?? null, targetKey, reporterId: userId, reason, detail: detail?.trim() || null }),
    );
    return { ok: true };
  }

  /** [관리자] 처리 대기 신고. 같은 대상에 몇 명이 신고했는지 함께 보여 준다. */
  async openReports() {
    const rows = await this.reports.find({
      where: { status: ReportStatus.OPEN },
      relations: ['offer', 'reporter'],
      order: { createdAt: 'DESC' },
      take: 200,
    });
    const msgIds = rows.map((r) => r.messageId).filter((x): x is string => Boolean(x));
    const msgs = msgIds.length ? await this.messages.find({ where: msgIds.map((id) => ({ id })) }) : [];
    const count = new Map<string, number>();
    for (const r of rows) count.set(`${r.offerId}:${r.targetKey}`, (count.get(`${r.offerId}:${r.targetKey}`) ?? 0) + 1);
    return rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      detail: r.detail,
      createdAt: r.createdAt,
      reporter: r.reporter?.name ?? '탈퇴한 사용자',
      sameTargetReports: count.get(`${r.offerId}:${r.targetKey}`) ?? 1,
      offer: { id: r.offerId, title: r.offer?.title ?? '', status: r.offer?.status },
      message: r.messageId ? { id: r.messageId, content: msgs.find((m) => m.id === r.messageId)?.content ?? '' } : null,
    }));
  }

  /** [관리자] 신고 처리. 같은 대상의 열린 신고를 함께 닫는다. */
  async resolveReport(reportId: string, action: 'DISMISS' | 'HIDE_MESSAGE' | 'CLOSE_OFFER') {
    const report = await this.reports.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException('신고를 찾을 수 없습니다');
    if (action === 'HIDE_MESSAGE') {
      if (!report.messageId) throw new BadRequestException('문의 신고만 가릴 수 있어요');
      await this.messages.update({ id: report.messageId }, { hiddenAt: new Date() });
    }
    if (action === 'CLOSE_OFFER') await this.offers.update({ id: report.offerId }, { status: OfferStatus.CLOSED });
    await this.reports.update(
      { offerId: report.offerId, targetKey: report.targetKey, status: ReportStatus.OPEN },
      { status: ReportStatus.RESOLVED, action },
    );
    return { ok: true };
  }

  private view(o: ExpertOffer, avg?: DomainAverage, track?: VerificationTrack, rating?: { avg: number; count: number }) {
    return {
      id: o.id,
      domainType: o.domainType,
      domainLabel: DOMAIN_LABELS[o.domainType],
      title: o.title,
      excerpt: o.description.replace(/\s+/g, ' ').slice(0, 90),
      price: Number(o.price),
      fee: calculatePlatformFee(Number(o.price)),
      serviceType: o.serviceType,
      area: o.area,
      days: o.days,
      status: o.status,
      orderCount: o.orderCount,
      messageCount: o.messageCount,
      expert: { id: o.expertId, name: o.expert?.name ?? '전문가' },
      verification: track ? { track, label: TRACK_LABELS[track] } : null,
      images: o.images ?? [],
      rating: rating ?? null,
      domainAverage: avg && avg.count >= 3 ? avg.avg : null,
      domainAverageCount: avg?.count ?? 0,
      createdAt: o.createdAt,
    };
  }
}
