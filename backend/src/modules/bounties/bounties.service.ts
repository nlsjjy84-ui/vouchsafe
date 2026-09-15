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
import { CreateMilestonesDto } from './dto/create-milestones.dto';
import { BountyStatus } from '../../common/enums/bounty-status.enum';
import { MilestoneStatus } from '../../common/enums/milestone-status.enum';
import { CertificationsService } from '../certifications/certifications.service';
import { TransactionsService } from '../transactions/transactions.service';
import { UsersService } from '../users/users.service';
import { DomainType } from '../../common/enums/domain-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../common/enums/notification-type.enum';

/** 8장 "무이의 기간": 결과물 제출 후 이 기간이 지나도록 승인/이의제기가 없으면 자동 정산 */
export const NO_OBJECTION_PERIOD_DAYS = 5;

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

  /** 마이페이지 대시보드(DashboardModule)용 — 내가 의뢰인이거나 담당 전문가인 바운티 목록 */
  findMine(userId: string, limit = 10): Promise<Bounty[]> {
    return this.bountyRepository
      .createQueryBuilder('bounty')
      .where('bounty.clientId = :userId', { userId })
      .orWhere('bounty.assignedExpertId = :userId', { userId })
      .orderBy('bounty.updatedAt', 'DESC')
      .take(limit)
      .getMany();
  }

  async findOneOrThrow(id: string): Promise<Bounty> {
    const bounty = await this.bountyRepository.findOne({ where: { id } });
    if (!bounty) throw new NotFoundException('바운티를 찾을 수 없습니다');
    return bounty;
  }

  /**
   * 기획서 8장 PENDING: "국가 공인 자격 등 등록·검증 조건을 충족한 전문가만
   * 해당 바운티에 지원할 수 있다" — 해당 도메인 APPROVED 인증이 없으면 지원 자체를 막는다.
   */
  async apply(bountyId: string, expertId: string, dto: ApplyBountyDto) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (bounty.status !== BountyStatus.PENDING) {
      throw new BadRequestException('이미 진행 중이거나 종료된 바운티에는 지원할 수 없습니다');
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
      `"${bounty.title}" 바운티에 새 지원자가 도착했습니다.`,
      bountyId,
    );
    return saved;
  }

  listApplicants(bountyId: string) {
    return this.applicationRepository.find({
      where: { bountyId },
      relations: ['expert'],
    });
  }

  /**
   * 기획서 8장 LOCKED: "양측 협상 타결 + CI 실명 확인 후 에스크로에 자금 락업".
   *
   * Phase 2: 검증(읽기)은 트랜잭션 밖에서 먼저 끝내고, 실제 쓰기 4단계
   * (지원자 상태 일괄 변경 → 바운티 상태 전환 → 에스크로 락업 기록 생성)는
   * DataSource.transaction()으로 묶는다. 예를 들어 지원자 상태는 다 바뀌었는데
   * 에스크로 락업(외부 연동)만 실패하는 경우, 트랜잭션 전체가 롤백돼서
   * "지원자는 SELECTED인데 에스크로는 비어있는" 불일치 상태가 DB에 남지 않는다.
   */
  async selectApplicant(bountyId: string, applicationId: string, clientId: string) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (bounty.clientId !== clientId) {
      throw new ForbiddenException('본인이 등록한 바운티만 전문가를 선택할 수 있습니다');
    }
    if (bounty.status !== BountyStatus.PENDING) {
      throw new BadRequestException('이미 진행 중인 바운티입니다');
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
      bounty.status = BountyStatus.LOCKED;
      await bountyRepo.save(bounty);

      await this.transactionsService.lockEscrow(bounty, client, selected.expertId, manager);
      return bounty;
    }).then(async (result) => {
      await this.notificationsService.notify(
        selected.expertId,
        NotificationType.BOUNTY_SELECTED,
        `"${bounty.title}" 바운티의 담당 전문가로 선택되었습니다.`,
        bountyId,
      );
      return result;
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
      `"${bounty.title}" 바운티의 결과물이 제출되었습니다. 검토 후 승인해주세요.`,
      bountyId,
    );
    return saved;
  }

  getSubmissions(bountyId: string) {
    return this.submissionRepository.find({ where: { bountyId }, order: { createdAt: 'DESC' } });
  }

  /**
   * 기획서 8장 SETTLED: "의뢰인 승인 후 수수료를 반영해 전문가에게 정산".
   * 의뢰인이 직접 누르는 승인 경로. 실제 정산 로직은 settleSubmittedBounty에 모아두고
   * 여기서는 "본인이 등록한 바운티인지"만 추가로 검사한다.
   */
  async approve(bountyId: string, clientId: string) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (bounty.clientId !== clientId) {
      throw new ForbiddenException('본인이 등록한 바운티만 승인할 수 있습니다');
    }
    return this.settleSubmittedBounty(bounty, false);
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
   * Phase 2: 정산 기록 생성(TransactionsService)과 바운티 상태 전환을 한 트랜잭션으로 묶어서,
   * "정산은 기록됐는데 바운티 상태는 SUBMITTED로 남아있는" 불일치를 방지한다.
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
      ? `"${bounty.title}" 바운티가 무이의 기간 만료로 자동 정산되었습니다.`
      : `"${bounty.title}" 바운티가 승인되어 정산이 완료되었습니다.`;
    await this.notificationsService.notify(expert.id, type, expertMessage, bounty.id);
    if (isAuto) {
      await this.notificationsService.notify(
        bounty.clientId,
        type,
        `"${bounty.title}" 바운티가 무이의 기간(${NO_OBJECTION_PERIOD_DAYS}일) 만료로 자동 정산되었습니다.`,
        bounty.id,
      );
    }
    return result;
  }

  /**
   * SettlementSchedulerService가 매시 호출 — SUBMITTED 상태로 `days`일 이상 머물러 있는
   * (= 무이의 기간이 지난) 바운티 목록을 찾는다. DISPUTED로 전환된 건은 SUBMITTED가 아니게
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
  // 큰 바운티를 여러 단계로 나눠서, 단계가 끝날 때마다 그만큼씩 에스크로에서
  // 전문가에게 지급한다. 일반 제출/승인(submitResult/approve)과는 별개의 흐름이라,
  // 마일스톤을 쓰기로 한 바운티는 그쪽 API 대신 아래 마일스톤 API를 사용한다.
  // ===========================================================================

  /** [의뢰인] LOCKED 상태에서만 마일스톤을 정의할 수 있고, 합계가 바운티 금액과 정확히 같아야 한다 */
  async createMilestones(bountyId: string, clientId: string, dto: CreateMilestonesDto) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (bounty.clientId !== clientId) {
      throw new ForbiddenException('본인이 등록한 바운티에만 마일스톤을 설정할 수 있습니다');
    }
    if (bounty.status !== BountyStatus.LOCKED) {
      throw new BadRequestException('에스크로가 락업된 상태에서만 마일스톤을 설정할 수 있습니다');
    }

    const existing = await this.milestoneRepository.count({ where: { bountyId } });
    if (existing > 0) {
      throw new BadRequestException('이미 마일스톤이 설정된 바운티입니다');
    }

    const sum = dto.milestones.reduce((acc, m) => acc + m.amount, 0);
    if (sum !== Number(bounty.bountyAmount)) {
      throw new BadRequestException(
        `마일스톤 금액 합계(${sum}원)가 바운티 총액(${bounty.bountyAmount}원)과 일치해야 합니다`,
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
   * TransactionsService가 알아서 SETTLED로 바꾸고, 여기서는 바운티 상태도 함께 SETTLED로 맞춘다.
   */
  async approveMilestone(bountyId: string, milestoneId: string, clientId: string) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (bounty.clientId !== clientId) {
      throw new ForbiddenException('본인이 등록한 바운티만 승인할 수 있습니다');
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

      // 에스크로가 이번 승인으로 전액 정산 완료됐다면 바운티 상태도 SETTLED로 맞춘다.
      if (Number(transaction.settledAmount) >= Number(transaction.amount)) {
        bounty.status = BountyStatus.SETTLED;
        await manager.getRepository(Bounty).save(bounty);
      }

      return milestone;
    }).then(async (result) => {
      await this.notificationsService.notify(
        expert.id,
        NotificationType.MILESTONE_SETTLED,
        `"${bounty.title}" 바운티의 마일스톤 "${milestone.title}"이(가) 정산되었습니다.`,
        bounty.id,
      );
      return result;
    });
  }

  /**
   * DisputesService에서 이의제기 접수 시 호출 - 바운티 상태만 여기서 책임지고
   * 자금 동결은 TransactionsService가 처리한다. manager를 넘기면 호출자의 트랜잭션에 합류.
   */
  async markDisputed(bountyId: string, manager?: EntityManager) {
    const bountyRepo = manager ? manager.getRepository(Bounty) : this.bountyRepository;
    const bounty = await bountyRepo.findOne({ where: { id: bountyId } });
    if (!bounty) throw new NotFoundException('바운티를 찾을 수 없습니다');
    if (bounty.status !== BountyStatus.SUBMITTED) {
      throw new BadRequestException('결과물 제출 후에만 이의제기가 가능합니다');
    }
    bounty.status = BountyStatus.DISPUTED;
    return bountyRepo.save(bounty);
  }

  async markSettledAfterDispute(bountyId: string, manager?: EntityManager) {
    const bountyRepo = manager ? manager.getRepository(Bounty) : this.bountyRepository;
    const bounty = await bountyRepo.findOne({ where: { id: bountyId } });
    if (!bounty) throw new NotFoundException('바운티를 찾을 수 없습니다');
    bounty.status = BountyStatus.SETTLED;
    return bountyRepo.save(bounty);
  }
}
