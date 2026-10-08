import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AiRunnerService } from './ai-runner.service';
import { AiMeta } from './ai.types';
import { Bounty } from '../bounties/entities/bounty.entity';
import { BountyApplication } from '../bounties/entities/bounty-application.entity';
import { BountySubmission } from '../bounties/entities/bounty-submission.entity';
import { Certification } from '../certifications/entities/certification.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { User } from '../users/entities/user.entity';
import { ReputationService } from '../users/reputation.service';
import { BountyRequirementSet } from './entities/bounty-requirement-set.entity';
import { BountyStatus } from '../../common/enums/bounty-status.enum';
import { DomainType, DOMAIN_LABELS } from '../../common/enums/domain-type.enum';
import { VerificationStatus } from '../../common/enums/verification-track.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import {
  REQUIREMENTS_INSTRUCTIONS,
  buildRequirementsPrompt,
  ruleBasedRequirements,
  toItems,
  validateRequirements,
} from './features/requirements.feature';
import {
  RANKING_INSTRUCTIONS,
  buildRankingPrompt,
  effortScore,
  labelOf,
  ruleFit,
  validateFits,
} from './features/ranking.feature';
import {
  SUBMISSION_INSTRUCTIONS,
  buildSubmissionPrompt,
  ruleBasedChecks,
  validateChecks,
} from './features/submission-check.feature';
import {
  DISPUTE_INSTRUCTIONS,
  buildDisputePrompt,
  factsCorpus,
  ruleBasedDisputeSummary,
  validateDisputeSummary,
} from './features/dispute-summary.feature';
import {
  BOUNTY_FIT_MAX,
  BOUNTY_MATCH_INSTRUCTIONS,
  EXPERT_FIT_MAX,
  EXPERT_MATCH_INSTRUCTIONS,
  bountyLabel,
  buildBountyMatchPrompt,
  buildExpertMatchPrompt,
  competitionPts,
  experiencePts,
  expertLabel,
  freshnessPts,
  ruleTopicFit,
  validateMatchFits,
} from './features/matching.feature';
import {
  MILESTONE_INSTRUCTIONS,
  PRICE_INSTRUCTIONS,
  MIN_SAMPLES,
  buildMilestonePrompt,
  buildPricePrompt,
  computeStats,
  positionOf,
  ruleBasedMilestones,
  ruleBasedPriceComment,
  validateMilestones,
  validatePriceComment,
} from './features/price-milestone.feature';

import {
  ALL_REVIEW_KEYWORDS,
  REVIEW_DRAFT_INSTRUCTIONS,
  REVIEW_SUMMARY_INSTRUCTIONS,
  REVIEW_SUMMARY_MIN,
  ReviewFacts,
  ReviewItem,
  ReviewSummary,
  buildReviewDraftPrompt,
  buildReviewSummaryPrompt,
  reviewDraftCorpus,
  ruleBasedReviewDraft,
  ruleBasedReviewSummary,
  validateReviewDraft,
  validateReviewSummary,
} from './features/review.feature';

import {
  BOUNTY_DRAFT_INSTRUCTIONS,
  BOUNTY_DRAFT_MIN_IDEA,
  BountyDraft,
  buildBountyDraftPrompt,
  ruleBasedBountyDraft,
  validateBountyDraft,
} from './features/bounty-draft.feature';
import {
  RISK_INSTRUCTIONS,
  RiskSignal,
  buildRiskPrompt,
  mergeRisk,
  ruleBasedRisk,
  validateRisk,
} from './features/risk-check.feature';

type AuthUser = { userId: string; role: string };

@Injectable()
export class AiService {
  constructor(
    private readonly runner: AiRunnerService,
    private readonly reputation: ReputationService,
    @InjectRepository(Bounty) private readonly bounties: Repository<Bounty>,
    @InjectRepository(BountyApplication) private readonly applications: Repository<BountyApplication>,
    @InjectRepository(BountySubmission) private readonly submissions: Repository<BountySubmission>,
    @InjectRepository(Certification) private readonly certs: Repository<Certification>,
    @InjectRepository(Dispute) private readonly disputes: Repository<Dispute>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(BountyRequirementSet) private readonly reqSets: Repository<BountyRequirementSet>,
  ) {}

  /** 화면 상단 "AI 연결 상태" 표시용. 키 값은 절대 돌려주지 않고 설정 여부만 알려준다. */
  status() {
    const provider = this.runner.selectedProvider();
    return {
      provider: provider?.name ?? 'none',
      configured: provider?.isConfigured() ?? false,
      mode: provider?.isConfigured() ? 'AI' : 'RULE',
      model: provider?.isConfigured() ? process.env.AI_MODEL ?? null : null,
    };
  }

  private async clientBounty(bountyId: string, userId: string): Promise<Bounty> {
    const b = await this.bounties.findOne({ where: { id: bountyId } });
    if (!b) throw new NotFoundException('프로젝트를 찾을 수 없습니다');
    if (b.clientId !== userId) throw new ForbiddenException('본인이 등록한 프로젝트만 사용할 수 있습니다');
    return b;
  }

  private async partyBounty(bountyId: string, userId: string): Promise<Bounty> {
    const b = await this.bounties.findOne({ where: { id: bountyId } });
    if (!b) throw new NotFoundException('프로젝트를 찾을 수 없습니다');
    if (b.clientId !== userId && b.assignedExpertId !== userId) {
      throw new ForbiddenException('이 프로젝트의 의뢰인 또는 담당 전문가만 사용할 수 있습니다');
    }
    return b;
  }

  // ───────── 기능 1: 요구사항 체크리스트 ─────────

  async draftRequirements(bountyId: string, user: AuthUser) {
    const b = await this.clientBounty(bountyId, user.userId);
    const existing = await this.reqSets.findOne({ where: { bountyId } });
    if (existing?.confirmedAt) {
      throw new BadRequestException('이미 확정된 요구사항이 있어 새 초안을 만들 수 없습니다');
    }
    const { result, meta } = await this.runner.run<string[]>({
      feature: 'REQUIREMENTS_DRAFT',
      bountyId,
      requesterId: user.userId,
      instructions: REQUIREMENTS_INSTRUCTIONS,
      userPrompt: buildRequirementsPrompt(b.title, b.description, DOMAIN_LABELS[b.domainType]),
      maxTokens: 700,
      validate: validateRequirements,
      fallback: () => ruleBasedRequirements(b.description),
    });
    const set = existing ?? this.reqSets.create({ bountyId });
    set.items = toItems(result);
    set.draftSource = meta.source;
    set.confirmedAt = null;
    set.confirmedBy = null;
    const saved = await this.reqSets.save(set);
    return { requirementSet: saved, meta };
  }

  /** 의뢰인이 항목을 고쳐서 확정한다. PENDING/PAYMENT_PENDING에서는 언제든, LOCKED에서는 아직 없을 때만. */
  async confirmRequirements(bountyId: string, user: AuthUser, texts: string[]) {
    const b = await this.clientBounty(bountyId, user.userId);
    const existing = await this.reqSets.findOne({ where: { bountyId } });
    const early = b.status === BountyStatus.PENDING || b.status === BountyStatus.PAYMENT_PENDING;
    const lockedFirstTime = b.status === BountyStatus.LOCKED && !existing?.confirmedAt;
    if (!early && !lockedFirstTime) {
      throw new BadRequestException('이 단계에서는 요구사항을 확정하거나 바꿀 수 없습니다');
    }
    const cleaned = texts.map((t) => (t ?? '').replace(/\s+/g, ' ').trim()).filter((t) => t.length >= 2);
    if (cleaned.length < 1 || cleaned.length > 10) {
      throw new BadRequestException('요구사항은 1~10개여야 합니다');
    }
    const set = existing ?? this.reqSets.create({ bountyId, draftSource: 'CLIENT' });
    set.items = toItems(cleaned.map((t) => t.slice(0, 200)));
    set.confirmedAt = new Date();
    set.confirmedBy = user.userId;
    return this.reqSets.save(set);
  }

  async getRequirements(bountyId: string, user: AuthUser) {
    await this.partyBounty(bountyId, user.userId);
    return (await this.reqSets.findOne({ where: { bountyId } })) ?? null;
  }

  // ───────── 기능 2: 지원자 추천 정렬 ─────────

  async rankApplicants(bountyId: string, user: AuthUser) {
    const b = await this.clientBounty(bountyId, user.userId);
    const apps = await this.applications.find({ where: { bountyId }, relations: ['expert'] });
    if (apps.length === 0) return { ranking: [], meta: null };

    const labels = apps.map((_, i) => labelOf(i));
    const bountyText = `${b.title}\n${b.description}`;

    const { result: fits, meta } = await this.runner.run<Map<string, { score: number; reason: string }>>({
      feature: 'APPLICANT_RANKING',
      bountyId,
      requesterId: user.userId,
      instructions: RANKING_INSTRUCTIONS,
      userPrompt: buildRankingPrompt(
        b.title,
        b.description,
        apps.map((a, i) => ({ label: labels[i], message: a.message ?? '' })),
      ),
      maxTokens: 900,
      validate: (json) => validateFits(json, labels),
      fallback: () =>
        new Map(apps.map((a, i) => [labels[i], ruleFit(bountyText, a.message ?? '')])),
    });

    const approved = await this.certs.find({
      where: {
        userId: In(apps.map((a) => a.expertId)),
        domainType: b.domainType,
        verifiedStatus: VerificationStatus.APPROVED,
      },
    });

    const rows = await Promise.all(
      apps.map(async (a, i) => {
        const rep = await this.reputation.getExpertReputation(a.expertId);
        const reputationPts = rep.hasEnoughData ? Math.round(rep.reputationScore * 45) : 22;
        const certCount = approved.filter((c) => c.userId === a.expertId).length;
        const certPts = certCount >= 2 ? 25 : certCount === 1 ? 20 : 0;
        const fit = fits.get(labels[i]) ?? { score: 0, reason: '' };
        const effortPts = effortScore(a.message ?? '');
        return {
          applicationId: a.id,
          expertId: a.expertId,
          expertName: a.expert?.name ?? null,
          label: labels[i],
          totalScore: reputationPts + certPts + fit.score + effortPts,
          breakdown: {
            reputation: { points: reputationPts, max: 45, note: rep.hasEnoughData ? '정산·분쟁·처리속도 이력 기준' : '이력이 부족해 중간값(22점) 적용' },
            certification: { points: certPts, max: 25, note: `이 분야 승인된 자격 ${certCount}건` },
            messageFit: { points: fit.score, max: 20, note: fit.reason },
            messageEffort: { points: effortPts, max: 10, note: '메시지 길이 기준' },
          },
        };
      }),
    );
    rows.sort((x, y) => y.totalScore - x.totalScore);
    return { ranking: rows, meta };
  }

  // ───────── 기능 7: 의뢰 → 전문가 추천 (AI 매칭) ─────────

  /** 완료(SETTLED)한 프로젝트 제목들 (최근순). 같은 분야만 거를 수도 있다. */
  private async pastTitles(expertId: string, domainType?: DomainType, take = 5): Promise<string[]> {
    const rows = await this.bounties.find({
      where: domainType
        ? { assignedExpertId: expertId, status: BountyStatus.SETTLED, domainType }
        : { assignedExpertId: expertId, status: BountyStatus.SETTLED },
      order: { updatedAt: 'DESC' },
      take,
      select: ['id', 'title'],
    });
    return rows.map((r) => r.title);
  }

  async recommendExperts(bountyId: string, user: AuthUser) {
    const b = await this.clientBounty(bountyId, user.userId);
    if (b.status !== BountyStatus.PENDING) {
      throw new BadRequestException('지원자를 모집 중인 프로젝트에서만 전문가를 추천받을 수 있습니다');
    }
    // 1) 서버가 후보를 거른다: 이 분야에서 승인된 자격이 있는 전문가만. 본인(의뢰인)은 제외.
    const certRows = await this.certs.find({
      where: { domainType: b.domainType, verifiedStatus: VerificationStatus.APPROVED },
    });
    const certCount = new Map<string, number>();
    for (const c of certRows) certCount.set(c.userId, (certCount.get(c.userId) ?? 0) + 1);
    const candidateIds = [...certCount.keys()].filter((id) => id !== b.clientId).slice(0, 30);
    if (candidateIds.length === 0) {
      return { recommendations: [], meta: null, note: '이 분야에서 승인된 자격을 가진 전문가가 아직 없습니다.' };
    }
    const applied = new Set(
      (await this.applications.find({ where: { bountyId }, select: ['id', 'expertId'] })).map((a) => a.expertId),
    );

    // 2) 후보별 서버 계산 값
    const people = await Promise.all(
      candidateIds.map(async (id) => {
        const [rep, titles, settledInDomain] = await Promise.all([
          this.reputation.getExpertReputation(id),
          this.pastTitles(id, b.domainType),
          this.bounties.count({ where: { assignedExpertId: id, status: BountyStatus.SETTLED, domainType: b.domainType } }),
        ]);
        return { id, rep, titles, settledInDomain };
      }),
    );
    const users = await this.usersLookup(candidateIds);

    // 3) 이력이 있는 후보만 AI에 보낸다(이름 없이 라벨만). 이력이 없으면 주제 점수 0.
    const withHistory = people.filter((p) => p.titles.length > 0);
    const labels = withHistory.map((_, i) => expertLabel(i));
    const bountyText = `${b.title}\n${b.description}`;
    let fits = new Map<string, { score: number; reason: string }>();
    let meta: AiMeta | null = null;
    if (withHistory.length > 0) {
      const out = await this.runner.run<Map<string, { score: number; reason: string }>>({
        feature: 'EXPERT_MATCH',
        bountyId,
        requesterId: user.userId,
        instructions: EXPERT_MATCH_INSTRUCTIONS,
        userPrompt: buildExpertMatchPrompt(
          b.title,
          b.description,
          withHistory.map((p, i) => ({ label: labels[i], titles: p.titles })),
        ),
        maxTokens: 3000,
        validate: (json) => validateMatchFits(json, labels, EXPERT_FIT_MAX),
        fallback: () =>
          new Map(withHistory.map((p, i) => [labels[i], ruleTopicFit(bountyText, p.titles, EXPERT_FIT_MAX)])),
      });
      fits = out.result;
      meta = out.meta;
    }

    const rows = people.map((p) => {
      const idx = withHistory.indexOf(p);
      const fit = idx >= 0 ? fits.get(labels[idx]) ?? { score: 0, reason: '' } : { score: 0, reason: '이 분야 완료 이력이 없어 주제 적합도를 계산하지 않음' };
      const repPts = p.rep.hasEnoughData ? Math.round(p.rep.reputationScore * 40) : 20;
      const n = certCount.get(p.id) ?? 0;
      const certPts = n >= 2 ? 25 : 20;
      const expPts = experiencePts(p.settledInDomain);
      return {
        expertId: p.id,
        expertName: users.get(p.id) ?? null,
        label: idx >= 0 ? labels[idx] : null,
        alreadyApplied: applied.has(p.id),
        completedInDomain: p.settledInDomain,
        totalScore: repPts + certPts + fit.score + expPts,
        breakdown: {
          reputation: { points: repPts, max: 40, note: p.rep.hasEnoughData ? '정산·분쟁·처리속도 이력 기준' : '이력이 부족해 중간값(20점) 적용' },
          certification: { points: certPts, max: 25, note: `이 분야 승인된 자격 ${n}건` },
          topicFit: { points: fit.score, max: EXPERT_FIT_MAX, note: fit.reason },
          experience: { points: expPts, max: 10, note: `이 분야 완료 ${p.settledInDomain}건` },
        },
      };
    });
    rows.sort((x, y) => y.totalScore - x.totalScore);
    return { recommendations: rows.slice(0, 10), meta, note: null };
  }

  private async usersLookup(ids: string[]): Promise<Map<string, string>> {
    const rows = await this.userRepo.find({ where: { id: In(ids) }, select: ['id', 'name'] });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  // ───────── 기능 8: 전문가 → 의뢰 추천 (AI 매칭) ─────────

  async recommendBounties(user: AuthUser) {
    if (user.role !== UserRole.EXPERT) throw new ForbiddenException('전문가만 사용할 수 있습니다');
    const myCerts = await this.certs.find({
      where: { userId: user.userId, verifiedStatus: VerificationStatus.APPROVED },
    });
    const domains = [...new Set(myCerts.map((c) => c.domainType))];
    if (domains.length === 0) {
      return { recommendations: [], meta: null, note: '승인된 자격이 있어야 맞는 프로젝트를 추천받을 수 있습니다.' };
    }
    const mine = new Set(
      (await this.applications.find({ where: { expertId: user.userId }, select: ['id', 'bountyId'] })).map((a) => a.bountyId),
    );
    const open = (
      await this.bounties.find({
        where: { domainType: In(domains), status: BountyStatus.PENDING },
        order: { createdAt: 'DESC' },
        take: 40,
      })
    )
      .filter((x) => x.clientId !== user.userId && !mine.has(x.id))
      .slice(0, 12);
    if (open.length === 0) return { recommendations: [], meta: null, note: '지금 지원할 수 있는 프로젝트가 없습니다.' };

    const counts = new Map<string, number>();
    for (const x of open) counts.set(x.id, await this.applications.count({ where: { bountyId: x.id } }));
    const titles = await this.pastTitles(user.userId, undefined, 8);

    const labels = open.map((_, i) => bountyLabel(i));
    let fits = new Map<string, { score: number; reason: string }>();
    let meta: AiMeta | null = null;
    if (titles.length > 0) {
      const out = await this.runner.run<Map<string, { score: number; reason: string }>>({
        feature: 'BOUNTY_MATCH',
        bountyId: null,
        requesterId: user.userId,
        instructions: BOUNTY_MATCH_INSTRUCTIONS,
        userPrompt: buildBountyMatchPrompt(
          titles,
          open.map((x, i) => ({ label: labels[i], title: x.title, description: x.description })),
        ),
        maxTokens: 3500,
        validate: (json) => validateMatchFits(json, labels, BOUNTY_FIT_MAX),
        fallback: () =>
          new Map(open.map((x, i) => [labels[i], ruleTopicFit(`${x.title}\n${x.description}`, titles, BOUNTY_FIT_MAX)])),
      });
      fits = out.result;
      meta = out.meta;
    }

    const rows = open.map((x, i) => {
      const fit = titles.length > 0 ? fits.get(labels[i]) ?? { score: 0, reason: '' } : { score: 0, reason: '완료 이력이 없어 주제 적합도를 계산하지 않음' };
      const fresh = freshnessPts(x.createdAt);
      const comp = competitionPts(counts.get(x.id) ?? 0);
      return {
        bountyId: x.id,
        title: x.title,
        domainType: x.domainType,
        amount: Number(x.bountyAmount),
        applicantCount: counts.get(x.id) ?? 0,
        totalScore: 30 + fit.score + fresh + comp,
        breakdown: {
          domain: { points: 30, max: 30, note: '승인된 자격이 있는 분야' },
          topicFit: { points: fit.score, max: BOUNTY_FIT_MAX, note: fit.reason },
          freshness: { points: fresh, max: 10, note: '등록 후 경과일 기준' },
          competition: { points: comp, max: 10, note: `현재 지원자 ${counts.get(x.id) ?? 0}명` },
        },
      };
    });
    rows.sort((a, b) => b.totalScore - a.totalScore);
    return { recommendations: rows.slice(0, 8), meta, note: null };
  }

  // ───────── 기능 3: 제출물 1차 점검 ─────────

  async checkSubmission(bountyId: string, user: AuthUser) {
    const b = await this.partyBounty(bountyId, user.userId);
    const set = await this.reqSets.findOne({ where: { bountyId } });
    if (!set?.confirmedAt) {
      throw new BadRequestException('확정된 요구사항이 없어 점검할 수 없습니다. 먼저 요구사항을 확정하세요');
    }
    const latest = await this.submissions.findOne({ where: { bountyId }, order: { createdAt: 'DESC' } });
    if (!latest) throw new BadRequestException('제출된 결과물이 없습니다');
    const note = latest.note ?? '';
    const fileName = latest.fileUrl.split('/').pop() ?? 'file';
    const { result, meta } = await this.runner.run({
      feature: 'SUBMISSION_CHECK',
      bountyId,
      requesterId: user.userId,
      instructions: SUBMISSION_INSTRUCTIONS,
      userPrompt: buildSubmissionPrompt(set.items, note, fileName),
      maxTokens: 1500,
      validate: (json) => validateChecks(json, set.items, note),
      fallback: () => ruleBasedChecks(set.items, note),
    });
    return {
      checks: result,
      limitation: '파일 안의 내용은 읽지 못했습니다. 제출 메모와 파일 이름만으로 점검한 결과입니다.',
      meta,
    };
  }

  // ───────── 기능 4: 분쟁 요약 (관리자) ─────────

  async summarizeDispute(disputeId: string, user: AuthUser) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('관리자만 사용할 수 있습니다');
    const d = await this.disputes.findOne({ where: { id: disputeId } });
    if (!d) throw new NotFoundException('분쟁을 찾을 수 없습니다');
    const b = await this.bounties.findOne({ where: { id: d.bountyId } });
    if (!b) throw new NotFoundException('프로젝트를 찾을 수 없습니다');
    const set = await this.reqSets.findOne({ where: { bountyId: b.id } });
    const subs = await this.submissions.find({ where: { bountyId: b.id }, order: { createdAt: 'ASC' } });
    const facts = {
      bountyTitle: b.title,
      bountyDescription: b.description,
      amount: Number(b.bountyAmount),
      disputeReason: d.reason,
      requirements: set?.confirmedAt ? set.items.map((i) => `${i.id}. ${i.text}`) : [],
      submissionNotes: subs.map((s) => s.note ?? '').filter((n) => n),
      submissionCount: subs.length,
    };
    const corpus = factsCorpus(facts);
    const { result, meta } = await this.runner.run({
      feature: 'DISPUTE_SUMMARY',
      bountyId: b.id,
      requesterId: user.userId,
      instructions: DISPUTE_INSTRUCTIONS,
      userPrompt: buildDisputePrompt(facts),
      maxTokens: 1200,
      validate: (json) => validateDisputeSummary(json, corpus),
      fallback: () => ruleBasedDisputeSummary(facts),
    });
    return { summary: result, meta };
  }

  // ───────── 기능 9: 후기 작성 도우미 (의뢰인) ─────────

  async draftReview(
    bountyId: string,
    input: { rating: number; keywords: string[]; hint?: string },
    user: AuthUser,
  ) {
    const b = await this.clientBounty(bountyId, user.userId);
    if (b.status !== BountyStatus.SETTLED) throw new BadRequestException('정산이 완료된 거래만 후기를 쓸 수 있습니다');
    if (b.clientRating !== null) throw new BadRequestException('이미 후기를 남긴 거래입니다');
    const keywords = [...new Set(input.keywords ?? [])].filter((k) => ALL_REVIEW_KEYWORDS.includes(k)).slice(0, 6);
    const [submissionCount, dispute] = await Promise.all([
      this.submissions.count({ where: { bountyId } }),
      this.disputes.findOne({ where: { bountyId } }),
    ]);
    const facts: ReviewFacts = {
      domainLabel: DOMAIN_LABELS[b.domainType],
      durationDays: Math.max(0, Math.round((new Date(b.updatedAt).getTime() - new Date(b.createdAt).getTime()) / 86_400_000)),
      submissionCount,
      wentThroughDispute: !!dispute,
      rating: input.rating,
      keywords,
      hint: (input.hint ?? '').trim().slice(0, 200),
    };
    const corpus = reviewDraftCorpus(facts);
    const { result, meta } = await this.runner.run<string>({
      feature: 'REVIEW_DRAFT',
      bountyId,
      requesterId: user.userId,
      instructions: REVIEW_DRAFT_INSTRUCTIONS,
      userPrompt: buildReviewDraftPrompt(facts),
      maxTokens: 500,
      validate: (json) => validateReviewDraft(json, corpus),
      fallback: () => ruleBasedReviewDraft(facts),
    });
    return { note: result, meta };
  }

  // ───────── 기능 10: 전문가 후기 요약 ─────────

  private readonly reviewSummaryCache = new Map<string, { at: number; value: unknown }>();

  async summarizeExpertReviews(expertId: string, user: AuthUser) {
    const expert = await this.userRepo.findOne({ where: { id: expertId } });
    if (!expert || (expert.role !== UserRole.EXPERT && expert.role !== UserRole.HYBRID)) {
      throw new NotFoundException('전문가를 찾을 수 없습니다');
    }
    const rows = await this.bounties.find({
      where: { assignedExpertId: expertId, status: BountyStatus.SETTLED },
      order: { updatedAt: 'DESC' },
    });
    const items: ReviewItem[] = rows
      .filter((r) => r.clientRating !== null && (r.clientRatingNote ?? '').trim().length > 0)
      .slice(0, 20)
      .map((r) => ({ rating: Number(r.clientRating), note: (r.clientRatingNote as string).trim() }));
    if (items.length < REVIEW_SUMMARY_MIN) {
      return {
        enoughData: false,
        sampleCount: items.length,
        message: `글로 남긴 후기가 ${items.length}건이라 요약하지 않아요 (최소 ${REVIEW_SUMMARY_MIN}건 필요).`,
        summary: null,
        meta: null,
      };
    }
    // 같은 후기 묶음이면 30분 동안 결과를 재사용해 AI 호출 비용을 아낀다.
    const key = `${expertId}:${items.map((i) => `${i.rating}|${i.note}`).join('\n')}`;
    const hit = this.reviewSummaryCache.get(key);
    if (hit && Date.now() - hit.at < 30 * 60_000) return hit.value;

    const { result, meta } = await this.runner.run<ReviewSummary>({
      feature: 'REVIEW_SUMMARY',
      bountyId: null,
      requesterId: user.userId,
      instructions: REVIEW_SUMMARY_INSTRUCTIONS,
      userPrompt: buildReviewSummaryPrompt(items),
      maxTokens: 900,
      validate: (json) => validateReviewSummary(json, items),
      fallback: () => ruleBasedReviewSummary(items),
    });
    const value = { enoughData: true, sampleCount: items.length, message: null, summary: result, meta };
    if (this.reviewSummaryCache.size > 200) this.reviewSummaryCache.clear();
    this.reviewSummaryCache.set(key, { at: Date.now(), value });
    return value;
  }

  // ───────── 기능 11: 프로젝트 등록 도우미 (의뢰인) ─────────

  async draftBounty(idea: string, serviceType: string, user: AuthUser) {
    const text = (idea ?? '').trim();
    if (text.length < BOUNTY_DRAFT_MIN_IDEA) {
      throw new BadRequestException(`아이디어를 ${BOUNTY_DRAFT_MIN_IDEA}자 이상 적어 주세요`);
    }
    const { result, meta } = await this.runner.run<BountyDraft>({
      feature: 'BOUNTY_DRAFT',
      bountyId: null,
      requesterId: user.userId,
      instructions: BOUNTY_DRAFT_INSTRUCTIONS,
      userPrompt: buildBountyDraftPrompt(text, serviceType),
      maxTokens: 1200,
      validate: (json) => validateBountyDraft(json, text),
      fallback: () => ruleBasedBountyDraft(text),
    });
    // 금액은 AI가 정하지 않고, 같은 분야에서 실제로 정산된 금액 통계만 참고로 보여준다.
    let priceHint: { n: number; p25: number; median: number; p75: number } | null = null;
    if (result.domainType) {
      const rows = await this.bounties.find({
        where: { domainType: result.domainType, status: BountyStatus.SETTLED },
        select: ['id', 'bountyAmount'],
      });
      const stats = computeStats(rows.map((r) => Number(r.bountyAmount)));
      if (stats) priceHint = { n: stats.n, p25: stats.p25, median: stats.median, p75: stats.p75 };
    }
    return { draft: result, priceHint, meta };
  }

  // ───────── 기능 12: 위험 신호 점검 ─────────

  async checkRisk(text: string, kind: string, user: AuthUser) {
    const body = (text ?? '').trim();
    const rule = ruleBasedRisk(body);
    if (body.length < 15) {
      return { ...mergeRisk(rule, []), checkedChars: body.length, meta: null };
    }
    const { result, meta } = await this.runner.run<RiskSignal[]>({
      feature: 'RISK_CHECK',
      bountyId: null,
      requesterId: user.userId,
      instructions: RISK_INSTRUCTIONS,
      userPrompt: buildRiskPrompt(body, kind),
      maxTokens: 700,
      validate: (json) => validateRisk(json, body),
      fallback: () => [],
    });
    return { ...mergeRisk(rule, result), checkedChars: body.length, meta };
  }

  // ───────── 기능 5: 가격 참고 ─────────

  async priceReference(domainType: DomainType, amount: number | null, user: AuthUser, bountyId?: string) {
    if (!Object.values(DomainType).includes(domainType)) throw new BadRequestException('알 수 없는 분야입니다');
    const rows = await this.bounties.find({
      where: { domainType, status: BountyStatus.SETTLED },
      select: ['id', 'bountyAmount'],
    });
    const stats = computeStats(rows.map((r) => Number(r.bountyAmount)));
    if (!stats) {
      return {
        enoughData: false,
        sampleCount: rows.length,
        message: `같은 분야에서 정산 완료된 사례가 ${rows.length}건이라 참고 범위를 보여드릴 수 없습니다 (최소 ${MIN_SAMPLES}건 필요).`,
        meta: null,
      };
    }
    let title = '';
    let description = '';
    if (bountyId) {
      const b = await this.clientBounty(bountyId, user.userId);
      title = b.title;
      description = b.description;
    }
    const { result, meta } = await this.runner.run<string>({
      feature: 'PRICE_REFERENCE',
      bountyId: bountyId ?? null,
      requesterId: user.userId,
      instructions: PRICE_INSTRUCTIONS,
      userPrompt: buildPricePrompt(stats, amount, title, description),
      maxTokens: 400,
      validate: (json) => validatePriceComment(json, stats, amount),
      fallback: () => ruleBasedPriceComment(stats, amount),
    });
    return {
      enoughData: true,
      stats,
      position: amount ? positionOf(amount, stats) : null,
      comment: result,
      meta,
    };
  }

  // ───────── 기능 6: 마일스톤 초안 ─────────

  async draftMilestones(bountyId: string, user: AuthUser) {
    const b = await this.clientBounty(bountyId, user.userId);
    const total = Number(b.bountyAmount);
    const set = await this.reqSets.findOne({ where: { bountyId } });
    const reqs = set?.confirmedAt ? set.items.map((i) => `${i.id}. ${i.text}`) : [];
    const rule = ruleBasedMilestones(total);
    if (!rule) throw new BadRequestException('금액이 너무 작아 마일스톤으로 나눌 수 없습니다 (단계당 최소 1,000원)');
    const { result, meta } = await this.runner.run({
      feature: 'MILESTONE_DRAFT',
      bountyId,
      requesterId: user.userId,
      instructions: MILESTONE_INSTRUCTIONS,
      userPrompt: buildMilestonePrompt(b.title, b.description, reqs),
      maxTokens: 800,
      validate: (json) => validateMilestones(json, total),
      fallback: () => rule,
    });
    return {
      milestones: result,
      totalAmount: total,
      note: '초안입니다. 저장은 기존 마일스톤 설정 화면에서 의뢰인이 직접 확정합니다.',
      meta,
    };
  }

  history(bountyId: string) {
    return this.runner.history(bountyId);
  }
}
