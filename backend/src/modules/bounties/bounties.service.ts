import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Bounty } from './entities/bounty.entity';
import {
  ApplicationStatus,
  BountyApplication,
} from './entities/bounty-application.entity';
import { BountySubmission } from './entities/bounty-submission.entity';
import { BountyMilestone, BountyMilestoneStatus } from './entities/bounty-milestone.entity';
import { SafeNumberMapping } from './entities/safe-number-mapping.entity';
import { CreateBountyDto } from './dto/create-bounty.dto';
import { ApplyBountyDto } from './dto/apply-bounty.dto';
import { CreateMilestonesDto } from './dto/create-milestones.dto';
import { ServiceType } from '../../common/enums/service-type.enum';
import { BountyStatus } from '../../common/enums/bounty-status.enum';
import { CertificationsService } from '../certifications/certifications.service';
import { TransactionsService } from '../transactions/transactions.service';
import { UsersService } from '../users/users.service';
import { DomainType } from '../../common/enums/domain-type.enum';
import { MockSafeNumberService } from '../../mocks/mock-safe-number.service';
import { NotificationsService } from '../notifications/notifications.service';

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
    @InjectRepository(SafeNumberMapping)
    private readonly safeNumberRepository: Repository<SafeNumberMapping>,
    private readonly certificationsService: CertificationsService,
    private readonly transactionsService: TransactionsService,
    private readonly usersService: UsersService,
    private readonly safeNumberService: MockSafeNumberService,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 확장 기획 4장 "동행 서비스": serviceType이 COMPANION이면 전문가가 실제
   * 현장(부동산 임장, 중고차 점검 등)에 동행해야 하므로 언제·어디서 만날지가
   * 필수 정보다. REMOTE(기본값)는 기존과 완전히 동일하게 동작한다.
   */
  create(clientId: string, dto: CreateBountyDto) {
    const serviceType = dto.serviceType ?? ServiceType.REMOTE;

    if (serviceType === ServiceType.COMPANION) {
      if (!dto.scheduledAt || !dto.location) {
        throw new BadRequestException('동행 서비스는 예약 일시와 장소를 반드시 입력해야 합니다');
      }
      if (new Date(dto.scheduledAt).getTime() <= Date.now()) {
        throw new BadRequestException('예약 일시는 현재보다 미래여야 합니다');
      }
    }

    const bounty = this.bountyRepository.create({
      ...dto,
      clientId,
      serviceType,
      scheduledAt: serviceType === ServiceType.COMPANION ? new Date(dto.scheduledAt!) : null,
      location: serviceType === ServiceType.COMPANION ? dto.location! : null,
    });
    return this.bountyRepository.save(bounty);
  }

  /**
   * 바운티 목록 페이지네이션 (Task #27).
   * 바운티 수가 많아지면 한 번에 전체를 다 내려주는 건 응답 크기/속도 양쪽에
   * 문제가 된다. offset 기반(page/limit)으로 나눠서 내려준다 - 이 프로젝트
   * 규모에서는 커서 기반보다 구현/설명이 단순해서 더 적합하다고 판단했다.
   * limit은 최대 50으로 강제 - 클라이언트가 큰 값을 보내 한 번에 다 긁어가는 것 방지.
   */
  async findAll(
    filters: { domainType?: DomainType; status?: BountyStatus },
    page = 1,
    limit = 12,
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));

    const [items, total] = await this.bountyRepository.findAndCount({
      where: filters,
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }

  /**
   * [Task #31 마이페이지] 내가 의뢰인으로 등록한 바운티 전체.
   * 최근 등록순으로, 최대 50개까지 - 내 것만 보는 화면이라 실사용 규모에서
   * 페이지네이션까지는 과할 걸로 보고 findAll()처럼 offset 방식은 쓰지 않았다
   * (사용량이 늘어나면 이 take 값과 함께 페이지네이션을 붙이면 된다).
   */
  async findMyBountiesAsClient(clientId: string): Promise<Bounty[]> {
    return this.bountyRepository.find({
      where: { clientId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  /**
   * [Task #31 마이페이지] 내가 전문가로 지원한 바운티 전체 (아직 선정 전/선정됨/
   * 반려됨 상태 전부 포함) - 각 지원 건마다 그 대상 바운티 정보까지 같이 내려준다.
   * `relations: ['bounty']`로 TypeORM이 JOIN해서 한 번의 쿼리로 가져온다.
   */
  async findMyApplicationsAsExpert(expertId: string): Promise<BountyApplication[]> {
    return this.applicationRepository.find({
      where: { expertId },
      relations: ['bounty'],
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async findOneOrThrow(id: string, manager?: EntityManager): Promise<Bounty> {
    const repo = manager ? manager.getRepository(Bounty) : this.bountyRepository;
    const bounty = await repo.findOne({ where: { id } });
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
    return this.applicationRepository.save(application);
  }

  listApplicants(bountyId: string) {
    return this.applicationRepository.find({
      where: { bountyId },
      relations: ['expert'],
    });
  }

  /**
   * 기획서 8장 LOCKED로 가기 위한 1단계: "양측 협상 타결" 확정.
   *
   * [Task #26 트랜잭션 처리] 지원자 선택 확정 → 나머지 반려 → 바운티 상태 전환 →
   * 결제 대기 트랜잭션 생성, 이 네 가지 쓰기는 서로 다른 테이블(BountyApplication,
   * Bounty, Transaction)에 걸쳐 있지만 하나라도 실패하면 전부 없었던 일이 되어야
   * 한다 - 예를 들어 지원자는 SELECTED로 바뀌었는데 Transaction 생성이 실패하면,
   * 결제할 방법이 없는데 전문가만 확정되어버리는 상태로 DB가 망가진다.
   * `this.dataSource.transaction()`으로 묶어서, 도중에 예외가 던져지면 TypeORM이
   * 자동으로 전체 롤백한다 (커넥션 하나를 계속 재사용하는 QueryRunner를 내부적으로
   * 사용 - 수동으로 QueryRunner를 만들고 connect/startTransaction/commit/
   * rollback/release를 직접 호출하는 것과 동작은 동일하고, 실수로 release를
   * 빼먹는 등의 흔한 버그를 막아주는 더 안전한 래퍼다).
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

    const rejectedExpertIds: string[] = [];

    const result = await this.dataSource.transaction(async (manager: EntityManager) => {
      const applicationRepo = manager.getRepository(BountyApplication);
      const bountyRepo = manager.getRepository(Bounty);

      // 선택된 지원자는 SELECTED, 나머지는 REJECTED로 일괄 처리
      const allApplications = await applicationRepo.find({ where: { bountyId } });
      for (const app of allApplications) {
        if (app.id === applicationId) {
          app.status = ApplicationStatus.SELECTED;
        } else {
          app.status = ApplicationStatus.REJECTED;
          rejectedExpertIds.push(app.expertId);
        }
      }
      await applicationRepo.save(allApplications);

      bounty.assignedExpertId = selected.expertId;
      bounty.status = BountyStatus.PAYMENT_PENDING;
      await bountyRepo.save(bounty);

      const transaction = await this.transactionsService.initiatePayment(
        bounty,
        client,
        selected.expertId,
        manager,
      );
      return { bounty, paymentId: transaction.paymentId, amount: transaction.amount };
    });

    // Task #30 인앱 알림: 알림 발송 실패가 지원자 선택 자체를 실패시키면 안 되므로
    // 반드시 트랜잭션이 커밋된 "뒤"에, 별도로 호출한다 (NotificationsService 상단 주석 참고).
    await this.notificationsService.notify(
      selected.expertId,
      'APPLICATION_SELECTED',
      '지원이 선택되었어요',
      `"${bounty.title}" 바운티에 선택되었습니다. 의뢰인의 결제가 확인되면 작업을 시작할 수 있어요.`,
      bountyId,
    );
    for (const expertId of rejectedExpertIds) {
      await this.notificationsService.notify(
        expertId,
        'APPLICATION_REJECTED',
        '다른 지원자가 선택되었어요',
        `"${bounty.title}" 바운티에 다른 전문가가 선택되었습니다.`,
        bountyId,
      );
    }

    return result;
  }

  /**
   * 기획서 8장 LOCKED로 가기 위한 2단계: 프론트에서 결제가 끝났다고 알려온 뒤 호출.
   * 실제로 결제가 됐는지는 TransactionsService.confirmLock이 PG사에 재확인한다 -
   * 여기서는 "이 바운티가 지금 결제를 기다리는 상태가 맞는지"만 검증한다.
   */
  async confirmPayment(bountyId: string, clientId: string) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (bounty.clientId !== clientId) {
      throw new ForbiddenException('본인이 등록한 바운티만 결제를 확인할 수 있습니다');
    }
    if (bounty.status !== BountyStatus.PAYMENT_PENDING) {
      throw new BadRequestException('결제 대기 상태의 바운티가 아닙니다');
    }

    // [Task #26] "PG 결제 확인됨" + "바운티 LOCKED 전환"이 따로 놀면, 돈은
    // 실제로 잠겼는데 바운티는 여전히 결제 대기로 보이는 불일치가 생길 수 있다.
    const saved = await this.dataSource.transaction(async (manager: EntityManager) => {
      await this.transactionsService.confirmLock(bountyId, manager);
      bounty.status = BountyStatus.LOCKED;
      return manager.getRepository(Bounty).save(bounty);
    });

    await this.notificationsService.notify(
      bounty.assignedExpertId!,
      'PAYMENT_LOCKED',
      '결제가 확인됐어요',
      `"${bounty.title}" 바운티의 결제가 확인되어 작업을 시작할 수 있습니다.`,
      bountyId,
    );

    return saved;
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
    if (await this.hasMilestones(bountyId)) {
      throw new BadRequestException(
        '마일스톤으로 나뉜 바운티입니다. /bounties/:id/milestones/:milestoneId/submit 로 단계별 제출해주세요',
      );
    }
    // 동행 서비스는 실제 현장 방문이 예약 일시에 끝난 뒤에만 소견서(결과물)를 제출할 수
    // 있다 - 방문 전에 미리 제출하는 건 "동행"의 의미와 맞지 않으므로 막는다.
    if (bounty.serviceType === ServiceType.COMPANION && bounty.scheduledAt && new Date() < bounty.scheduledAt) {
      throw new BadRequestException(
        `아직 예약된 동행 일시(${bounty.scheduledAt.toISOString()})가 되지 않았습니다`,
      );
    }

    const submission = this.submissionRepository.create({ bountyId, fileUrl, note });
    await this.submissionRepository.save(submission);

    bounty.status = BountyStatus.SUBMITTED;
    bounty.submittedAt = new Date();
    const saved = await this.bountyRepository.save(bounty);

    await this.notificationsService.notify(
      bounty.clientId,
      'SUBMISSION_RECEIVED',
      '결과물이 제출됐어요',
      `"${bounty.title}" 바운티의 결과물이 제출되었습니다. 확인 후 승인해주세요.`,
      bountyId,
    );

    return saved;
  }

  getSubmissions(bountyId: string) {
    return this.submissionRepository.find({ where: { bountyId }, order: { createdAt: 'DESC' } });
  }

  /**
   * 기획서 8장 SETTLED: "의뢰인 승인 후 수수료를 반영해 전문가에게 정산".
   * 무이의 기간 만료로 인한 자동 정산(auto-settlement.scheduler.ts)도 실제 정산
   * 로직은 이 메서드가 호출하는 settleSubmittedBounty()를 그대로 재사용한다 —
   * "누가 정산을 트리거했는가"(의뢰인 직접 승인 vs 시간 경과로 시스템이 자동 처리)만
   * 다를 뿐, 정산 자체의 규칙(수수료 계산, 상태 전환)은 완전히 동일해야 하기 때문이다.
   */
  async approve(bountyId: string, clientId: string) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (bounty.clientId !== clientId) {
      throw new ForbiddenException('본인이 등록한 바운티만 승인할 수 있습니다');
    }
    if (bounty.status !== BountyStatus.SUBMITTED) {
      throw new BadRequestException('결과물이 제출된 상태에서만 승인할 수 있습니다');
    }
    if (await this.hasMilestones(bountyId)) {
      throw new BadRequestException(
        '마일스톤으로 나뉜 바운티입니다. /bounties/:id/milestones/:milestoneId/approve 로 단계별 승인해주세요',
      );
    }
    return this.settleSubmittedBounty(bounty);
  }

  /**
   * approve()와 자동 정산 스케줄러가 공유하는 실제 정산 로직 (상태 검사는 호출하는 쪽 책임).
   * [Task #26] 정산(Transaction.escrowStatus=SETTLED)과 바운티 상태 전환을 하나로 묶어서,
   * "돈은 정산됐는데 바운티는 아직 SUBMITTED로 남아있는" 불일치를 방지한다.
   */
  private async settleSubmittedBounty(bounty: Bounty) {
    const expert = await this.usersService.findById(bounty.assignedExpertId!);
    if (!expert) throw new NotFoundException('전문가 정보를 찾을 수 없습니다');

    const saved = await this.dataSource.transaction(async (manager: EntityManager) => {
      await this.transactionsService.settleNormally(bounty.id, expert, manager);
      bounty.status = BountyStatus.SETTLED;
      return manager.getRepository(Bounty).save(bounty);
    });

    // approve()(의뢰인 직접 승인)와 autoSettleExpired()(자동 정산) 둘 다 이 헬퍼를
    // 공유하므로, 알림도 여기 한 곳에만 두면 두 경로 모두 자동으로 커버된다.
    await this.notificationsService.notify(
      bounty.assignedExpertId!,
      'BOUNTY_SETTLED',
      '정산이 완료됐어요',
      `"${bounty.title}" 바운티가 정산되어 대금이 지급되었습니다.`,
      bounty.id,
    );

    return saved;
  }

  /**
   * 확장 기획 4장 "먹튀 및 악의적 거부 방어": 결과물을 제출했는데 의뢰인이 승인도
   * 이의제기도 하지 않고 기간(cutoffDays)이 지나버린 바운티 목록을 찾는다.
   * auto-settlement.scheduler.ts가 주기적으로 이 메서드를 호출해서 대상을 찾는다.
   */
  async findExpiredSubmissions(cutoffDays: number): Promise<Bounty[]> {
    const cutoff = new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000);
    return this.bountyRepository
      .createQueryBuilder('bounty')
      .where('bounty.status = :status', { status: BountyStatus.SUBMITTED })
      .andWhere('bounty.submittedAt IS NOT NULL')
      .andWhere('bounty.submittedAt <= :cutoff', { cutoff })
      .getMany();
  }

  /**
   * 스케줄러 전용 자동 정산. approve()와 다르게 "의뢰인 본인 확인"을 하지 않는다 —
   * 애초에 사람이 아니라 시스템(시간 경과)이 트리거하는 것이기 때문이다. 대신
   * 상태가 여전히 SUBMITTED인지는 다시 한번 확인한다 (그 사이 의뢰인이 이미
   * 직접 승인했거나 이의제기를 했을 수도 있으므로 — 경쟁 상태 방지).
   */
  async autoSettleExpired(bountyId: string) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (bounty.status !== BountyStatus.SUBMITTED) {
      return null; // 이미 다른 경로로 처리됨 - 스케줄러가 조용히 건너뛴다
    }
    return this.settleSubmittedBounty(bounty);
  }

  /**
   * 무이의 기간이 지난 바운티를 찾아 전부 자동 정산하는 한 번의 "청소" 작업.
   * AutoSettlementScheduler(@Cron, 매시 정각)와, 관리자가 즉시 실행해보고 싶을 때
   * 쓰는 수동 트리거 API(BountiesController) 양쪽이 이 메서드 하나를 공유한다.
   * @returns 실제로 자동 정산된 바운티 개수
   */
  async runAutoSettlementSweep(cutoffDays: number): Promise<number> {
    const expired = await this.findExpiredSubmissions(cutoffDays);
    if (expired.length === 0) {
      return 0;
    }

    this.logger.log(`무이의 기간(${cutoffDays}일) 만료 자동 정산 대상 ${expired.length}건 발견`);
    let settledCount = 0;

    for (const bounty of expired) {
      try {
        const result = await this.autoSettleExpired(bounty.id);
        if (result) {
          settledCount += 1;
          this.logger.log(`[자동 정산 완료] bounty=${bounty.id} title="${bounty.title}"`);
        }
      } catch (err) {
        // 한 건 처리 실패가 나머지 건 처리를 막으면 안 되므로, 개별 건 단위로 에러를 잡는다.
        this.logger.error(
          `[자동 정산 실패] bounty=${bounty.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    return settledCount;
  }

  /**
   * DisputesService에서 이의제기 접수 시 호출 - 바운티 상태만 여기서 책임지고 자금
   * 동결은 TransactionsService가 처리한다. [Task #26] 이 둘(상태 전환 + 자금 동결)은
   * DisputesService.file()이 시작한 하나의 트랜잭션(manager) 안에서 함께 실행된다 -
   * "이의제기는 접수됐는데 자금은 동결 안 된" 상태가 생기면 안 되기 때문.
   */
  async markDisputed(bountyId: string, manager?: EntityManager) {
    const bounty = await this.findOneOrThrow(bountyId, manager);
    if (bounty.status !== BountyStatus.SUBMITTED) {
      throw new BadRequestException('결과물 제출 후에만 이의제기가 가능합니다');
    }
    bounty.status = BountyStatus.DISPUTED;
    const repo = manager ? manager.getRepository(Bounty) : this.bountyRepository;
    return repo.save(bounty);
  }

  async markSettledAfterDispute(bountyId: string, manager?: EntityManager) {
    const bounty = await this.findOneOrThrow(bountyId, manager);
    bounty.status = BountyStatus.SETTLED;
    const repo = manager ? manager.getRepository(Bounty) : this.bountyRepository;
    return repo.save(bounty);
  }

  /**
   * [버그 수정] 관리자가 이의제기를 "환불"로 중재했을 때 호출.
   * 예전에는 이 경우 바운티 상태가 DISPUTED에 그대로 멈춰 있어서, "아직 처리 안 된
   * 분쟁"과 "환불까지 끝난 분쟁"을 구분할 수 없었다 (평판 점수 계산 중 발견).
   */
  async markRefundedAfterDispute(bountyId: string, manager?: EntityManager) {
    const bounty = await this.findOneOrThrow(bountyId, manager);
    bounty.status = BountyStatus.REFUNDED;
    const repo = manager ? manager.getRepository(Bounty) : this.bountyRepository;
    return repo.save(bounty);
  }

  // =========================================================================
  // 확장 기획 4장 "마일스톤 분할 정산"
  // =========================================================================
  // 바운티 전체 금액은 지원자 선택→결제 완료 시점에 한 번에 락업되는 건 기존과
  // 동일하다 (BountiesService.selectApplicant / confirmPayment). 달라지는 건
  // "제출→승인"이 한 번이 아니라 여러 단계로 나뉘고, 승인할 때마다 그 몫만큼만
  // 부분 정산(TransactionsService.settleMilestone)된다는 점이다.
  //
  // 마일스톤을 쓰는 바운티인지는 별도 플래그 없이 "이 bountyId로 등록된
  // BountyMilestone 행이 있는지"로 판단한다 - defineMilestones가 성공하면
  // 그 즉시 이 바운티는 "마일스톤 바운티"가 되고, 일반 submitResult/approve는
  // 막힌다 (위 두 메서드의 hasMilestones 검사 참고).

  private async hasMilestones(bountyId: string): Promise<boolean> {
    const count = await this.milestoneRepository.count({ where: { bountyId } });
    return count > 0;
  }

  /**
   * [의뢰인] 바운티를 여러 마일스톤으로 분할 정의.
   * 반드시 지원자를 아직 선택하기 전(PENDING) 단계에서만 할 수 있게 제한한다 -
   * 이미 결제까지 끝난 뒤에 금액을 쪼개면 이미 락업된 총액과 안 맞을 수 있어서다.
   */
  async defineMilestones(bountyId: string, clientId: string, dto: CreateMilestonesDto) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (bounty.clientId !== clientId) {
      throw new ForbiddenException('본인이 등록한 바운티만 마일스톤을 설정할 수 있습니다');
    }
    if (bounty.status !== BountyStatus.PENDING) {
      throw new BadRequestException('지원자를 선택하기 전(모집중) 단계에서만 마일스톤을 설정할 수 있습니다');
    }
    if (await this.hasMilestones(bountyId)) {
      throw new BadRequestException('이미 마일스톤이 설정된 바운티입니다');
    }

    const sum = dto.items.reduce((acc, item) => acc + item.amount, 0);
    if (sum !== Number(bounty.bountyAmount)) {
      throw new BadRequestException(
        `마일스톤 금액의 합(${sum.toLocaleString()}원)이 바운티 전체 금액(${Number(bounty.bountyAmount).toLocaleString()}원)과 일치해야 합니다`,
      );
    }

    const milestones = dto.items.map((item, index) =>
      this.milestoneRepository.create({
        bountyId,
        sequence: index + 1,
        title: item.title,
        amount: item.amount,
        status: BountyMilestoneStatus.PENDING,
      }),
    );
    return this.milestoneRepository.save(milestones);
  }

  listMilestones(bountyId: string) {
    return this.milestoneRepository.find({ where: { bountyId }, order: { sequence: 'ASC' } });
  }

  /**
   * [전문가] 마일스톤 하나의 결과물 제출. 반드시 순서대로 제출해야 한다 -
   * 앞 단계가 APPROVED 되기 전까지는 다음 단계를 제출할 수 없다 (sequence 검증).
   */
  async submitMilestone(
    bountyId: string,
    milestoneId: string,
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

    const milestone = await this.milestoneRepository.findOne({ where: { id: milestoneId, bountyId } });
    if (!milestone) throw new NotFoundException('마일스톤을 찾을 수 없습니다');
    if (milestone.status !== BountyMilestoneStatus.PENDING) {
      throw new BadRequestException('이미 제출됐거나 승인된 마일스톤입니다');
    }
    if (milestone.sequence > 1) {
      const previous = await this.milestoneRepository.findOne({
        where: { bountyId, sequence: milestone.sequence - 1 },
      });
      if (previous && previous.status !== BountyMilestoneStatus.APPROVED) {
        throw new BadRequestException('이전 마일스톤이 승인되기 전까지는 다음 단계를 제출할 수 없습니다');
      }
    }

    milestone.fileUrl = fileUrl;
    milestone.note = note ?? null;
    milestone.status = BountyMilestoneStatus.SUBMITTED;
    milestone.submittedAt = new Date();
    const saved = await this.milestoneRepository.save(milestone);

    await this.notificationsService.notify(
      bounty.clientId,
      'SUBMISSION_RECEIVED',
      '마일스톤 결과물이 제출됐어요',
      `"${bounty.title}" 바운티의 "${milestone.title}" 마일스톤 결과물이 제출되었습니다. 확인 후 승인해주세요.`,
      bountyId,
    );

    return saved;
  }

  /**
   * [의뢰인] 마일스톤 하나 승인 → 그 몫만큼 부분 정산. 모든 마일스톤이 APPROVED가
   * 되는 순간 바운티 전체를 SETTLED로 전환한다 (일반 바운티의 approve()가 하는
   * "전체 정산 + 상태 전환"을 마일스톤 단위로 여러 번에 걸쳐 나눠 하는 셈).
   */
  /**
   * [Task #26] 마일스톤 하나 승인은 최소 두 테이블(BountyMilestone, Transaction),
   * 마지막 마일스톤이면 세 테이블(+Bounty)까지 함께 바뀐다. 부분 정산은 됐는데
   * 마일스톤 상태는 그대로거나, 마지막 단계인데 바운티가 SETTLED로 안 바뀌는 등의
   * 불일치를 막기 위해 전부 하나의 트랜잭션으로 묶는다.
   */
  async approveMilestone(bountyId: string, milestoneId: string, clientId: string) {
    const bounty = await this.findOneOrThrow(bountyId);
    if (bounty.clientId !== clientId) {
      throw new ForbiddenException('본인이 등록한 바운티만 승인할 수 있습니다');
    }

    const milestone = await this.milestoneRepository.findOne({ where: { id: milestoneId, bountyId } });
    if (!milestone) throw new NotFoundException('마일스톤을 찾을 수 없습니다');
    if (milestone.status !== BountyMilestoneStatus.SUBMITTED) {
      throw new BadRequestException('결과물이 제출된 마일스톤만 승인할 수 있습니다');
    }

    const expert = await this.usersService.findById(bounty.assignedExpertId!);
    if (!expert) throw new NotFoundException('전문가 정보를 찾을 수 없습니다');

    const savedMilestone = await this.dataSource.transaction(async (manager: EntityManager) => {
      const milestoneRepo = manager.getRepository(BountyMilestone);
      const bountyRepo = manager.getRepository(Bounty);

      await this.transactionsService.settleMilestone(bountyId, expert, Number(milestone.amount), manager);

      milestone.status = BountyMilestoneStatus.APPROVED;
      milestone.approvedAt = new Date();
      await milestoneRepo.save(milestone);

      const remaining = await milestoneRepo.count({
        where: { bountyId, status: BountyMilestoneStatus.PENDING },
      });
      const stillSubmitted = await milestoneRepo.count({
        where: { bountyId, status: BountyMilestoneStatus.SUBMITTED },
      });
      if (remaining === 0 && stillSubmitted === 0) {
        bounty.status = BountyStatus.SETTLED;
        await bountyRepo.save(bounty);
      }

      return milestone;
    });

    const isFullySettled = bounty.status === BountyStatus.SETTLED;
    await this.notificationsService.notify(
      bounty.assignedExpertId!,
      'MILESTONE_SETTLED',
      '마일스톤이 정산됐어요',
      `"${bounty.title}" 바운티의 "${milestone.title}" 마일스톤이 승인되어 정산되었습니다.` +
        (isFullySettled ? ' (모든 마일스톤이 끝나 바운티 전체가 정산 완료되었습니다)' : ''),
      bountyId,
    );

    return savedMilestone;
  }

  // ===========================================================================
  // 안심전화번호(가상번호) - 매칭된 의뢰인/전문가가 서로의 진짜 번호를 모른 채
  // 연락할 수 있게 해주는 기능. mock-safe-number.service.ts 주석 참고.
  // ===========================================================================

  /** 이 바운티에 접근할 자격(의뢰인 본인 또는 매칭된 전문가 본인)이 있는지 확인 */
  private assertSafeNumberParty(bounty: Bounty, userId: string): 'CLIENT' | 'EXPERT' {
    if (bounty.clientId === userId) return 'CLIENT';
    if (bounty.assignedExpertId === userId) return 'EXPERT';
    throw new ForbiddenException('이 바운티의 의뢰인 또는 매칭된 전문가만 안심번호를 이용할 수 있습니다');
  }

  /**
   * 안심번호를 조회한다. 아직 발급되지 않았으면 404 - 프론트엔드는 이걸
   * "아직 발급 전"으로 간주하고 발급 버튼을 보여주면 된다 (거래 조회 패턴과 동일).
   */
  async getSafeNumber(bountyId: string, userId: string) {
    const bounty = await this.findOneOrThrow(bountyId);
    this.assertSafeNumberParty(bounty, userId);

    const mapping = await this.safeNumberRepository.findOne({ where: { bountyId } });
    if (!mapping) throw new NotFoundException('아직 발급된 안심번호가 없습니다');
    return { safeNumber: mapping.safeNumber, createdAt: mapping.createdAt };
  }

  /**
   * 안심번호를 발급(최초 1회)하거나, 이미 있으면 그대로 반환한다(멱등).
   * 매칭되어 실제로 연락을 주고받을 필요가 생긴 시점(LOCKED 이후)에만 발급 가능하고,
   * 거래가 완전히 끝난 뒤(SETTLED/REFUNDED)에는 더 이상 새로 발급하지 않는다 -
   * 다만 이미 발급된 번호의 조회(getSafeNumber)는 이력 확인 차원에서 계속 허용한다.
   */
  async getOrCreateSafeNumber(bountyId: string, userId: string) {
    const bounty = await this.findOneOrThrow(bountyId);
    this.assertSafeNumberParty(bounty, userId);

    const activeStatuses: BountyStatus[] = [
      BountyStatus.LOCKED,
      BountyStatus.SUBMITTED,
      BountyStatus.DISPUTED,
    ];
    if (!activeStatuses.includes(bounty.status)) {
      throw new BadRequestException(
        '거래가 매칭(결제 완료)된 이후 ~ 종료되기 전에만 안심번호를 발급할 수 있습니다',
      );
    }
    if (!bounty.assignedExpertId) {
      throw new BadRequestException('아직 매칭된 전문가가 없습니다');
    }

    const existing = await this.safeNumberRepository.findOne({ where: { bountyId } });
    if (existing) {
      return { safeNumber: existing.safeNumber, createdAt: existing.createdAt };
    }

    const [client, expert] = await Promise.all([
      this.usersService.findById(bounty.clientId),
      this.usersService.findById(bounty.assignedExpertId),
    ]);
    if (!client?.phoneNumber || !expert?.phoneNumber) {
      const missing = !client?.phoneNumber ? '의뢰인' : '전문가';
      throw new BadRequestException(
        `${missing}이(가) 아직 전화번호를 등록하지 않아 안심번호를 발급할 수 없습니다`,
      );
    }

    const mapping = this.safeNumberRepository.create({
      bountyId,
      clientId: bounty.clientId,
      expertId: bounty.assignedExpertId,
      safeNumber: this.safeNumberService.generateSafeNumber(),
    });
    const saved = await this.safeNumberRepository.save(mapping);
    this.logger.log(`[안심번호] 바운티 ${bountyId} 에 ${saved.safeNumber} 발급`);
    return { safeNumber: saved.safeNumber, createdAt: saved.createdAt };
  }

  /** 발급된 안심번호로 "전화 연결"을 흉내낸다 (mock-safe-number.service.ts 주석 참고) */
  async relaySafeNumberCall(bountyId: string, userId: string) {
    const bounty = await this.findOneOrThrow(bountyId);
    const role = this.assertSafeNumberParty(bounty, userId);

    const mapping = await this.safeNumberRepository.findOne({ where: { bountyId } });
    if (!mapping) throw new NotFoundException('먼저 안심번호를 발급해주세요');

    return this.safeNumberService.relayCall(mapping.safeNumber, role);
  }
}
