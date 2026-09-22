import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, LessThanOrEqual, Repository } from 'typeorm';
import { Bounty } from './entities/bounty.entity';
import {
  ApplicationStatus,
  BountyApplication,
} from './entities/bounty-application.entity';
import { BountySubmission } from './entities/bounty-submission.entity';
import { BountyMilestone } from './entities/bounty-milestone.entity';
import { CreateBountyDto } from './dto/create-bounty.dto';
import { ApplyBountyDto } from './dto/apply-bounty.dto';
import { RateBountyDto } from './dto/rate-bounty.dto';
import { CreateMilestonesDto } from './dto/create-milestones.dto';
import { BountyStatus } from '../../common/enums/bounty-status.enum';
import { MilestoneStatus } from '../../common/enums/milestone-status.enum';
import { CertificationsService } from '../certifications/certifications.service';
import { TransactionsService } from '../transactions/transactions.service';
import { UsersService } from '../users/users.service';
import { ReputationService } from '../users/reputation.service';
import { DomainType, DOMAIN_LABELS } from '../../common/enums/domain-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../common/enums/notification-type.enum';

/** 8장 "무이의 기간": 결과물 제출 후 이 기간이 지나도록 승인/이의제기가 없으면 자동 정산 */
export const NO_OBJECTION_PERIOD_DAYS = 5;

/**
 * 공개 거래 사례(투명성 신뢰 지표) 한 건. GET /api/cases (PublicCasesController)의
 * 응답 형태 - 의뢰인/전문가 실명, 정확한 금액, 프로젝트 제목은 절대 담지 않는다
 * (익명화 원칙 - 사용자 요청 "익명화로 하자"를 그대로 반영).
 */
export interface PublicBountyCase {
  id: string;
  domainType: DomainType;
  domainLabel: string;
  durationDays: number; // 등록(createdAt) ~ 정산(updatedAt) 며칠 걸렸는지
  amountBand: string; // 정확한 금액 대신 구간으로만 공개
  systemScore: number; // 0~10, ReputationService가 자동 계산 - 조작 불가
  clientRating: number | null; // 1.0~10.0, 의뢰인이 직접 매긴 점수 (아직 안 매겼으면 null)
  clientRatingNote: string | null;
  expertHandle: string; // 익명화된 전문가 표기 (예: "김전문가-A1B2")
  settledAt: string;
}

@Injectable()
export class BountiesService {
  private readonly logger = new Logger(BountiesService.name);

  constructor(
    @InjectRepository(Bounty)
    private readonly bountyRepository: Repository<Bounty>,
    @InjectRepository(BountyApplication)
    private readonly applicationRepository: Repository<BountyApplication>,
    @InjectRepository(BountySubmission)
    private readonly submissionRepository: Repository<BountySubmission>,
    @InjectRepository(BountyMilestone)
    private readonly milestoneRepository: Repository<BountyMilestone>,
    private readonly certificationsService: CertificationsService,
    private readonly transactionsService: TransactionsService,
    private readonly usersService: UsersService,
    private readonly reputationService: ReputationService,
    private readonly notificationsService: NotificationsService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  create(clientId: string, dto: CreateBountyDto) {
    const bounty = this.bountyRepository.create({ ...dto, clientId });
    return this.bountyRepository.save(bounty);
  }

  findAll(filters: { domainType?: DomainType; status?: BountyStatus }) {
    return this.bountyRepository.find({
      where: filters,
      order: { createdAt: 'DESC' },
    });
  }

  /** 마이페이지 대시보드(DashboardModule)용 — 내가 의뢰인이거나 담당 전문가인 프로젝트 목록 */
  findMine(userId: string, limit = 10): Promise<Bounty[]> {
    return this.bountyRepository
      .createQueryBuilder('bounty')
      .where('bounty.clientId = :userId', { userId })
      .orWhere('bounty.assignedExpertId = :userId', { userId })
      .orderBy('bounty.updatedAt', 'DESC')
      .take(limit)
      .getMany();
  }

  /** 마이페이지 "내가 등록한 프로젝트" — 의뢰인으로서 등록한 프로젝트만 (DashboardModule용) */
  findMyAsClient(userId: string, limit = 10): Promise<Bounty[]> {
    return this.bountyRepository.find({
      where: { clientId: userId },
      order: { updatedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * 마이페이지 "내가 지원한 프로젝트" — 전문가로서 지원한 내역을 대상 프로젝트 정보와
   * 함께 내려준다 (DashboardModule용 - lib/types.ts의 BountyApplication.bounty 참고).
   */
  findMyApplications(userId: string, limit = 10): Promise<BountyApplication[]> {
    return this.applicationRepository.find({
      where: { expertId: userId },
      relations: ['bounty'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findOneOrThrow(id: string): Promise<Bounty> {
    const bounty = await this.bountyRepository.findOne({ where: { id } });
    if (!bounty) throw new NotFoundException('프로젝트를 찾을 수 없습니다');
    return bounty;
  }

  /**
   * 기획서 8장 PENDING: "국가 공인 자격 등 등록·검증 조건을 충족한 전문가만
   * 해당 프로젝트에 지원할 수 있다" — 해당 도메인 APPROVED 인증이 없으면 지원 자체를 막는다.
   */
  async apply(bountyId: string, expertId: string, dto: ApplyBountyDto) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (bounty.status !== BountyStatus.PENDING) {
      throw new BadRequestException('이미 진행 중이거나 종료된 프로젝트에는 지원할 수 없습니다');
    }

    const qualified = await this.certificationsService.hasApprovedCertification(
      expertId,
      bounty.domainType,
    );
    if (!qualified) {
      throw new ForbiddenException('해당 도메인에 대한 검증된 자격이 없어 지원할 수 없습니다');
    }

    const application = this.applicationRepository.create({
      bountyId,
      expertId,
      message: dto.message,
    });
    const saved = await this.applicationRepository.save(application);

    await this.notificationsService.notify(
      bounty.clientId,
      NotificationType.BOUNTY_APPLICATION_RECEIVED,
      `"${bounty.title}" 프로젝트에 새 지원자가 도착했습니다.`,
      bountyId,
    );
    return saved;
  }

  /**
   * [의뢰인] 지원자 목록 전체 조회. 의뢰인 본인이 아니면 다른 지원자의 메시지·정보를
   * 볼 필요가 없으므로(오히려 노출되면 안 됨) 본인이 낸 지원 내역만 돌려준다 —
   * 프론트의 "이미 지원했어요" 판단(alreadyApplied)에는 본인 것만 있어도 충분하다.
   * (2026-09-22 보안 점검: 이전에는 로그인만 하면 누구나 다른 사람의 지원 메시지까지
   * 볼 수 있었던 접근 제어 누락을 여기서 막는다.)
   */
  async listApplicants(bountyId: string, requesterId: string) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (bounty.clientId === requesterId) {
      return this.applicationRepository.find({
        where: { bountyId },
        relations: ['expert'],
      });
    }
    return this.applicationRepository.find({
      where: { bountyId, expertId: requesterId },
      relations: ['expert'],
    });
  }

  /**
   * 기획서 8장 "양측 협상 타결" 단계 (Task #14로 결제 확인 게이트 추가, 2026-09-16).
   * 예전에는 이 시점에 바로 에스크로를 잠갔지만, 지금은 "전문가를 정했다"와 "돈을
   * 실제로 냈다"를 같은 순간으로 취급하지 않는다 - 여기서는 결제 식별자(paymentId)만
   * 미리 발급해서 프로젝트를 PAYMENT_PENDING으로 옮겨두고, 실제 에스크로 락업은 의뢰인이
   * 결제창을 통과하고 confirmPayment()가 PG에 재확인한 뒤에야 일어난다.
   *
   * Phase 2: 검증(읽기)은 트랜잭션 밖에서 먼저 끝내고, 실제 쓰기 단계
   * (지원자 상태 일괄 변경 → 프로젝트 상태 전환 → 결제 대기 트랜잭션 생성)는
   * DataSource.transaction()으로 묶는다. 예를 들어 지원자 상태는 다 바뀌었는데
   * 결제 식별자 발급(외부 연동)만 실패하는 경우, 트랜잭션 전체가 롤백돼서
   * "지원자는 SELECTED인데 결제 대기 기록은 없는" 불일치 상태가 DB에 남지 않는다.
   */
  async selectApplicant(bountyId: string, applicationId: string, clientId: string) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (bounty.clientId !== clientId) {
      throw new ForbiddenException('본인이 등록한 프로젝트만 전문가를 선택할 수 있습니다');
    }
    if (bounty.status !== BountyStatus.PENDING) {
      throw new BadRequestException('이미 진행 중인 프로젝트입니다');
    }

    const selected = await this.applicationRepository.findOne({
      where: { id: applicationId, bountyId },
    });
    if (!selected) throw new NotFoundException('지원 내역을 찾을 수 없습니다');

    const client = await this.usersService.findById(clientId);
    if (!client) throw new NotFoundException('의뢰인 정보를 찾을 수 없습니다');

    return this.dataSource.transaction(async (manager: EntityManager) => {
      const applicationRepo = manager.getRepository(BountyApplication);
      const bountyRepo = manager.getRepository(Bounty);

      // 선택된 지원자는 SELECTED, 나머지는 REJECTED로 일괄 처리
      const allApplications = await applicationRepo.find({ where: { bountyId } });
      for (const app of allApplications) {
        app.status =
          app.id === applicationId ? ApplicationStatus.SELECTED : ApplicationStatus.REJECTED;
      }
      await applicationRepo.save(allApplications);

      bounty.assignedExpertId = selected.expertId;
      bounty.status = BountyStatus.PAYMENT_PENDING;
      await bountyRepo.save(bounty);

      await this.transactionsService.initiatePayment(bounty, client, selected.expertId, manager);
      return bounty;
    }).then(async (result) => {
      await this.notificationsService.notify(
        selected.expertId,
        NotificationType.BOUNTY_SELECTED,
        `"${bounty.title}" 프로젝트의 담당 전문가로 선택되었습니다. (의뢰인 결제 확인 대기중)`,
        bountyId,
      );
      return result;
    });
  }

  /**
   * Task #14 결제 확인 게이트: 의뢰인이 결제창(포트원 SDK)에서 결제를 마친 뒤 호출한다.
   * 프론트가 "결제 성공했다"고 알려와도 그 말을 그대로 믿지 않고, TransactionsService가
   * PG에 직접 재확인한 뒤에야(위변조 방지) 에스크로를 잠그고 프로젝트를 LOCKED로 옮긴다.
   */
  async confirmPayment(bountyId: string, clientId: string) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (bounty.clientId !== clientId) {
      throw new ForbiddenException('본인이 등록한 프로젝트만 결제를 확인할 수 있습니다');
    }
    if (bounty.status !== BountyStatus.PAYMENT_PENDING) {
      throw new BadRequestException('결제 대기 중인 프로젝트가 아닙니다');
    }

    return this.dataSource.transaction(async (manager: EntityManager) => {
      await this.transactionsService.confirmPayment(bountyId, manager);
      bounty.status = BountyStatus.LOCKED;
      return manager.getRepository(Bounty).save(bounty);
    });
  }

  /** 기획서 8장 SUBMITTED: 선택된 전문가만 결과물을 제출할 수 있다 */
  async submitResult(
    bountyId: string,
    expertId: string,
    fileUrl: string,
    note?: string,
  ) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (bounty.assignedExpertId !== expertId) {
      throw new ForbiddenException('선택된 전문가만 결과물을 제출할 수 있습니다');
    }
    if (bounty.status !== BountyStatus.LOCKED) {
      throw new BadRequestException('에스크로가 락업된 상태에서만 제출할 수 있습니다');
    }

    const submission = this.submissionRepository.create({ bountyId, fileUrl, note });
    await this.submissionRepository.save(submission);

    bounty.status = BountyStatus.SUBMITTED;
    bounty.submittedAt = new Date();
    const saved = await this.bountyRepository.save(bounty);

    await this.notificationsService.notify(
      bounty.clientId,
      NotificationType.BOUNTY_SUBMITTED,
      `"${bounty.title}" 프로젝트의 결과물이 제출되었습니다. 검토 후 승인해주세요.`,
      bountyId,
    );
    return saved;
  }

  /**
   * [의뢰인/담당 전문가] 제출된 결과물 목록 조회.
   * (2026-09-22 보안 점검: 로그인만 하면 누구나 다른 프로젝트의 결과물 파일 URL을
   * 볼 수 있었던 접근 제어 누락을 막는다 - 의뢰인 또는 담당 전문가만 조회 가능.)
   */
  async getSubmissions(bountyId: string, requesterId: string) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (requesterId !== bounty.clientId && requesterId !== bounty.assignedExpertId) {
      throw new ForbiddenException('이 프로젝트의 의뢰인 또는 담당 전문가만 조회할 수 있습니다');
    }
    return this.submissionRepository.find({ where: { bountyId }, order: { createdAt: 'DESC' } });
  }

  /**
   * 기획서 8장 SETTLED: "의뢰인 승인 후 수수료를 반영해 전문가에게 정산".
   * 의뢰인이 직접 누르는 승인 경로. 실제 정산 로직은 settleSubmittedBounty에 모아두고
   * 여기서는 "본인이 등록한 프로젝트인지"만 추가로 검사한다.
   */
  async approve(bountyId: string, clientId: string) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (bounty.clientId !== clientId) {
      throw new ForbiddenException('본인이 등록한 프로젝트만 승인할 수 있습니다');
    }
    return this.settleSubmittedBounty(bounty, false);
  }

  /**
   * [의뢰인] 공개 거래 사례용 평가 등록. 정산(SETTLED)이 끝난 뒤에만, 그리고 딱 한 번만
   * 매길 수 있다(이미 값이 있으면 재작성 불가 - 평가를 나중에 바꿔치기해서 조작하는 걸 막는다).
   * 시스템 점수(ReputationService)와 별개로 저장·공개된다.
   */
  async rate(bountyId: string, clientId: string, dto: RateBountyDto) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (bounty.clientId !== clientId) {
      throw new ForbiddenException('본인이 등록한 프로젝트만 평가할 수 있습니다');
    }
    if (bounty.status !== BountyStatus.SETTLED) {
      throw new BadRequestException('정산이 완료된 거래만 평가할 수 있습니다');
    }
    if (bounty.clientRating !== null) {
      throw new BadRequestException('이미 평가를 남긴 거래입니다');
    }
    bounty.clientRating = dto.rating.toFixed(1);
    bounty.clientRatingNote = dto.note ?? null;
    return this.bountyRepository.save(bounty);
  }

  /**
   * 공개 거래 사례 목록. GET /api/cases (PublicCasesController, 로그인 불필요)에서 호출한다.
   * "무조건 거래하면 사례 메뉴에 등록된다"는 요청대로 별도 등록 절차 없이, 정산(SETTLED)이
   * 끝난 거래는 전부 자동으로 이 목록에 나타난다 - 의뢰인/전문가가 따로 "공개할지 말지"를
   * 고를 수 없다(그래야 사례가 편집되지 않은 전수 데이터라는 신뢰가 생긴다).
   * 시스템 점수(ReputationService, 전문가별 1회만 계산해 재사용)와 의뢰인 점수(rate())는
   * 합치지 않고 나란히 따로 반환한다.
   */
  async listPublicCases(): Promise<PublicBountyCase[]> {
    const settled = await this.bountyRepository.find({
      where: { status: BountyStatus.SETTLED },
      order: { updatedAt: 'DESC' },
    });

    const systemScoreCache = new Map<string, number>();
    const cases: PublicBountyCase[] = [];

    for (const bounty of settled) {
      if (!bounty.assignedExpertId) continue;
      const expert = await this.usersService.findById(bounty.assignedExpertId);
      if (!expert) continue;

      let systemScore = systemScoreCache.get(bounty.assignedExpertId);
      if (systemScore === undefined) {
        const reputation = await this.reputationService.getExpertReputation(
          bounty.assignedExpertId,
        );
        systemScore = reputation.score10;
        systemScoreCache.set(bounty.assignedExpertId, systemScore);
      }

      const durationDays = Math.max(
        0,
        Math.round(
          (new Date(bounty.updatedAt).getTime() - new Date(bounty.createdAt).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );

      cases.push({
        id: bounty.id,
        domainType: bounty.domainType,
        domainLabel: DOMAIN_LABELS[bounty.domainType],
        durationDays,
        amountBand: this.amountBand(Number(bounty.bountyAmount)),
        systemScore,
        clientRating: bounty.clientRating !== null ? Number(bounty.clientRating) : null,
        clientRatingNote: bounty.clientRatingNote,
        expertHandle: this.anonymizeExpertHandle(expert.name, expert.id),
        settledAt: new Date(bounty.updatedAt).toISOString(),
      });
    }

    return cases;
  }

  /** 정확한 금액 대신 구간으로만 공개한다 (익명화 원칙 - 정확한 액수는 역추적 단서가 될 수 있음) */
  private amountBand(amount: number): string {
    if (amount < 100_000) return '10만원 미만';
    if (amount < 300_000) return '10만원~30만원';
    if (amount < 500_000) return '30만원~50만원';
    if (amount < 1_000_000) return '50만원~100만원';
    if (amount < 3_000_000) return '100만원~300만원';
    return '300만원 이상';
  }

  /**
   * 실명 대신 "성 이니셜 + 전문가 + id 앞 4자리" 형태로 익명 표기한다.
   * 같은 전문가는 항상 같은 표기가 나와서(expertId 기반) 사례 목록에서
   * "이 사람이 여러 건을 잘 처리했구나"는 알아볼 수 있되, 누구인지는 알 수 없다.
   */
  private anonymizeExpertHandle(name: string, expertId: string): string {
    const initial = name.trim().charAt(0) || '전';
    const suffix = expertId.replace(/-/g, '').slice(0, 4).toUpperCase();
    return `${initial}전문가-${suffix}`;
  }

  /**
   * 무이의 기간 만료 자동 정산 전용 진입점 (SettlementSchedulerService, 관리자 수동 트리거에서 호출).
   * approve()와 달리 clientId 소유권 검사를 하지 않는다 — 시스템/관리자가 주체이기 때문.
   */
  async autoApprove(bountyId: string) {
    const bounty = await this.findOneOrThrow(bountyId);
    return this.settleSubmittedBounty(bounty, true);
  }

  /**
   * Phase 2: 정산 기록 생성(TransactionsService)과 프로젝트 상태 전환을 한 트랜잭션으로 묶어서,
   * "정산은 기록됐는데 프로젝트 상태는 SUBMITTED로 남아있는" 불일치를 방지한다.
   * approve()(의뢰인 수동 승인)와 autoApprove()(무이의 기간 만료 자동 정산)가 이 메서드를 공유한다.
   * isAuto: 자동 정산이면 의뢰인도 함께 알림을 받는다 (본인이 누른 게 아니라 시간이 지나
   * 자동으로 일어난 일이라 알아야 하므로) — 수동 승인이면 의뢰인은 이미 알고 있어 전문가만 알린다.
   */
  private async settleSubmittedBounty(bounty: Bounty, isAuto: boolean) {
    if (bounty.status !== BountyStatus.SUBMITTED) {
      throw new BadRequestException('결과물이 제출된 상태에서만 승인할 수 있습니다');
    }

    const expert = await this.usersService.findById(bounty.assignedExpertId!);
    if (!expert) throw new NotFoundException('전문가 정보를 찾을 수 없습니다');

    const result = await this.dataSource.transaction(async (manager: EntityManager) => {
      await this.transactionsService.settleNormally(bounty.id, expert, manager);
      bounty.status = BountyStatus.SETTLED;
      return manager.getRepository(Bounty).save(bounty);
    });

    const type = isAuto ? NotificationType.BOUNTY_AUTO_SETTLED : NotificationType.BOUNTY_SETTLED;
    const expertMessage = isAuto
      ? `"${bounty.title}" 프로젝트가 무이의 기간 만료로 자동 정산되었습니다.`
      : `"${bounty.title}" 프로젝트가 승인되어 정산이 완료되었습니다.`;
    await this.notificationsService.notify(expert.id, type, expertMessage, bounty.id);
    if (isAuto) {
      await this.notificationsService.notify(
        bounty.clientId,
        type,
        `"${bounty.title}" 프로젝트가 무이의 기간(${NO_OBJECTION_PERIOD_DAYS}일) 만료로 자동 정산되었습니다.`,
        bounty.id,
      );
    }
    return result;
  }

  /**
   * SettlementSchedulerService가 매시 호출 — SUBMITTED 상태로 `days`일 이상 머물러 있는
   * (= 무이의 기간이 지난) 프로젝트 목록을 찾는다. DISPUTED로 전환된 건은 SUBMITTED가 아니게
   * 되므로 자동으로 이 목록에서 빠진다 (이의제기가 자동 정산을 막는다는 기획 의도 그대로).
   */
  findSettleableSubmitted(days: number = NO_OBJECTION_PERIOD_DAYS): Promise<Bounty[]> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.bountyRepository.find({
      where: { status: BountyStatus.SUBMITTED, submittedAt: LessThanOrEqual(cutoff) },
    });
  }

  // ===========================================================================
  // 마일스톤 분할 정산 (Phase 2)
  // 큰 프로젝트를 여러 단계로 나눠서, 단계가 끝날 때마다 그만큼씩 에스크로에서
  // 전문가에게 지급한다. 일반 제출/승인(submitResult/approve)과는 별개의 흐름이라,
  // 마일스톤을 쓰기로 한 프로젝트는 그쪽 API 대신 아래 마일스톤 API를 사용한다.
  // ===========================================================================

  /** [의뢰인] LOCKED 상태에서만 마일스톤을 정의할 수 있고, 합계가 프로젝트 금액과 정확히 같아야 한다 */
  async createMilestones(bountyId: string, clientId: string, dto: CreateMilestonesDto) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (bounty.clientId !== clientId) {
      throw new ForbiddenException('본인이 등록한 프로젝트에만 마일스톤을 설정할 수 있습니다');
    }
    if (bounty.status !== BountyStatus.LOCKED) {
      throw new BadRequestException('에스크로가 락업된 상태에서만 마일스톤을 설정할 수 있습니다');
    }

    const existing = await this.milestoneRepository.count({ where: { bountyId } });
    if (existing > 0) {
      throw new BadRequestException('이미 마일스톤이 설정된 프로젝트입니다');
    }

    const sum = dto.milestones.reduce((acc, m) => acc + m.amount, 0);
    if (sum !== Number(bounty.bountyAmount)) {
      throw new BadRequestException(
        `마일스톤 금액 합계(${sum}원)가 프로젝트 총액(${bounty.bountyAmount}원)과 일치해야 합니다`,
      );
    }

    const rows = dto.milestones.map((m, index) =>
      this.milestoneRepository.create({
        bountyId,
        title: m.title,
        amount: m.amount,
        sortOrder: index,
        status: MilestoneStatus.PENDING,
      }),
    );
    return this.milestoneRepository.save(rows);
  }

  listMilestones(bountyId: string) {
    return this.milestoneRepository.find({ where: { bountyId }, order: { sortOrder: 'ASC' } });
  }

  private async findMilestoneOrThrow(bountyId: string, milestoneId: string) {
    const milestone = await this.milestoneRepository.findOne({
      where: { id: milestoneId, bountyId },
    });
    if (!milestone) throw new NotFoundException('마일스톤을 찾을 수 없습니다');
    return milestone;
  }

  /** [전문가] 이번 마일스톤 몫의 작업을 제출 */
  async submitMilestone(
    bountyId: string,
    milestoneId: string,
    expertId: string,
    note?: string,
  ) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (bounty.assignedExpertId !== expertId) {
      throw new ForbiddenException('선택된 전문가만 마일스톤을 제출할 수 있습니다');
    }
    const milestone = await this.findMilestoneOrThrow(bountyId, milestoneId);
    if (milestone.status !== MilestoneStatus.PENDING) {
      throw new BadRequestException('이미 제출되었거나 승인된 마일스톤입니다');
    }
    milestone.status = MilestoneStatus.SUBMITTED;
    milestone.submissionNote = note ?? null;
    return this.milestoneRepository.save(milestone);
  }

  /**
   * [의뢰인] 마일스톤 승인 → 그 몫만큼 즉시 부분 정산.
   * 모든 마일스톤이 APPROVED가 되면(= 에스크로 settledAmount가 총액에 도달하면)
   * TransactionsService가 알아서 SETTLED로 바꾸고, 여기서는 프로젝트 상태도 함께 SETTLED로 맞춘다.
   */
  async approveMilestone(bountyId: string, milestoneId: string, clientId: string) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (bounty.clientId !== clientId) {
      throw new ForbiddenException('본인이 등록한 프로젝트만 승인할 수 있습니다');
    }
    const milestone = await this.findMilestoneOrThrow(bountyId, milestoneId);
    if (milestone.status !== MilestoneStatus.SUBMITTED) {
      throw new BadRequestException('제출된 마일스톤만 승인할 수 있습니다');
    }
    const expert = await this.usersService.findById(bounty.assignedExpertId!);
    if (!expert) throw new NotFoundException('전문가 정보를 찾을 수 없습니다');

    return this.dataSource.transaction(async (manager: EntityManager) => {
      const transaction = await this.transactionsService.settleMilestonePortion(
        bountyId,
        Number(milestone.amount),
        expert,
        manager,
      );

      milestone.status = MilestoneStatus.APPROVED;
      await manager.getRepository(BountyMilestone).save(milestone);

      // 에스크로가 이번 승인으로 전액 정산 완료됐다면 프로젝트 상태도 SETTLED로 맞춘다.
      if (Number(transaction.settledAmount) >= Number(transaction.amount)) {
        bounty.status = BountyStatus.SETTLED;
        await manager.getRepository(Bounty).save(bounty);
      }

      return milestone;
    }).then(async (result) => {
      await this.notificationsService.notify(
        expert.id,
        NotificationType.MILESTONE_SETTLED,
        `"${bounty.title}" 프로젝트의 마일스톤 "${milestone.title}"이(가) 정산되었습니다.`,
        bounty.id,
      );
      return result;
    });
  }

  /**
   * DisputesService에서 이의제기 접수 시 호출 - 프로젝트 상태만 여기서 책임지고
   * 자금 동결은 TransactionsService가 처리한다. manager를 넘기면 호출자의 트랜잭션에 합류.
   */
  async markDisputed(bountyId: string, manager?: EntityManager) {
    const bountyRepo = manager ? manager.getRepository(Bounty) : this.bountyRepository;
    const bounty = await bountyRepo.findOne({ where: { id: bountyId } });
    if (!bounty) throw new NotFoundException('프로젝트를 찾을 수 없습니다');
    if (bounty.status !== BountyStatus.SUBMITTED) {
      throw new BadRequestException('결과물 제출 후에만 이의제기가 가능합니다');
    }
    bounty.status = BountyStatus.DISPUTED;
    return bountyRepo.save(bounty);
  }

  async markSettledAfterDispute(bountyId: string, manager?: EntityManager) {
    const bountyRepo = manager ? manager.getRepository(Bounty) : this.bountyRepository;
    const bounty = await bountyRepo.findOne({ where: { id: bountyId } });
    if (!bounty) throw new NotFoundException('프로젝트를 찾을 수 없습니다');
    bounty.status = BountyStatus.SETTLED;
    return bountyRepo.save(bounty);
  }

  /**
   * DisputesService.resolve()의 refund=true(전문가 귀책 환불) 분기에서 호출 - 자금은
   * TransactionsService.refundExpertFault()가 REFUNDED로 되돌리고, 여기서는 프로젝트
   * 자체의 상태를 DISPUTED에서 REFUNDED로 종결한다. markSettledAfterDispute()의
   * 환불 버전 (2026-09-17 추가 - 원래 이 호출이 빠져 있어서 환불 처리된 프로젝트가
   * DISPUTED에 영원히 머무르는 버그가 있었다).
   */
  async markRefundedAfterDispute(bountyId: string, manager?: EntityManager) {
    const bountyRepo = manager ? manager.getRepository(Bounty) : this.bountyRepository;
    const bounty = await bountyRepo.findOne({ where: { id: bountyId } });
    if (!bounty) throw new NotFoundException('프로젝트를 찾을 수 없습니다');
    bounty.status = BountyStatus.REFUNDED;
    return bountyRepo.save(bounty);
  }
}
