import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Dispute, DisputeStatus } from './entities/dispute.entity';
import { FileDisputeDto } from './dto/file-dispute.dto';
import { BountiesService } from '../bounties/bounties.service';
import { TransactionsService } from '../transactions/transactions.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../common/enums/notification-type.enum';

/**
 * 기획서 9장 "DISPUTED: 이의제기가 들어오면 자금부터 동결한다".
 * 판단(관리자 1차 중재)은 지금 단계에서는 관리자 역할 유저가 API로 직접 승인/반려하는
 * 형태로 단순화했다 (실제로는 통화 이력 등 추가 근거가 필요 - Phase 2에서 보강 예정).
 *
 * Phase 2: file()과 resolve() 모두 "프로젝트/에스크로 상태를 동시에 바꾸는" 다단계 작업이라
 * DataSource.transaction()으로 묶는다 — 예를 들어 상태는 DISPUTED로 바뀌었는데
 * 자금 동결(freeze)만 실패해 자금이 계속 정상 흐름을 탈 수 있는 상황을 막기 위함.
 */
@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(Dispute)
    private readonly disputeRepository: Repository<Dispute>,
    private readonly bountiesService: BountiesService,
    private readonly transactionsService: TransactionsService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async file(bountyId: string, clientId: string, dto: FileDisputeDto) {
    const bounty = await this.bountiesService.findOneOrThrow(bountyId);
    if (bounty.clientId !== clientId) {
      throw new ForbiddenException('본인이 등록한 프로젝트에 대해서만 이의제기할 수 있습니다');
    }

    const dispute = await this.dataSource.transaction(async (manager: EntityManager) => {
      // 1) 프로젝트 상태를 DISPUTED로 전환 (SUBMITTED 상태에서만 가능 - BountiesService에서 검사)
      await this.bountiesService.markDisputed(bountyId, manager);
      // 2) 에스크로 자금 즉시 동결
      await this.transactionsService.freeze(bountyId, manager);

      const disputeRepo = manager.getRepository(Dispute);
      const created = disputeRepo.create({ bountyId, reason: dto.reason });
      return disputeRepo.save(created);
    });

    if (bounty.assignedExpertId) {
      await this.notificationsService.notify(
        bounty.assignedExpertId,
        NotificationType.DISPUTE_FILED,
        `"${bounty.title}" 프로젝트에 이의제기가 접수되어 에스크로 자금이 동결되었습니다.`,
        bountyId,
      );
    }
    return dispute;
  }

  /**
   * (2026-09-22 보안 점검: 로그인만 하면 누구나 다른 프로젝트의 이의제기 사유를
   * 볼 수 있었던 접근 제어 누락을 막는다 - 의뢰인 또는 담당 전문가만 조회 가능.)
   */
  async findByBounty(bountyId: string, requesterId: string) {
    const bounty = await this.bountiesService.findOneOrThrow(bountyId);
    if (requesterId !== bounty.clientId && requesterId !== bounty.assignedExpertId) {
      throw new ForbiddenException('이 프로젝트의 의뢰인 또는 담당 전문가만 조회할 수 있습니다');
    }
    return this.disputeRepository.find({ where: { bountyId }, order: { createdAt: 'DESC' } });
  }

  /** [관리자] 아직 처리되지 않은(OPEN) 분쟁 전체 목록 - 관리자 대시보드용 */
  findOpenWithBounty() {
    return this.disputeRepository.find({
      where: { status: DisputeStatus.OPEN },
      relations: ['bounty'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * 관리자 1차 중재 결과 반영.
   * refund=true  → 9장 "전문가 귀책(먹튀) 환불": 의뢰인 전액 환불 + 전문가 자격 제재는 Phase 2
   * refund=false → 전문가 손을 들어줌: 정상 정산 그대로 진행
   */
  async resolve(disputeId: string, adminNote: string, refund: boolean) {
    const dispute = await this.disputeRepository.findOne({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException('분쟁 건을 찾을 수 없습니다');

    const bounty = await this.bountiesService.findOneOrThrow(dispute.bountyId);

    // refund=false 분기에서만 필요하지만, 트랜잭션 밖에서 먼저 조회해 실패를 빨리 드러낸다
    let expert: User | null = null;
    if (!refund) {
      expert = await this.usersService.findById(bounty.assignedExpertId!);
      if (!expert) throw new NotFoundException('전문가 정보를 찾을 수 없습니다');
    }

    const saved = await this.dataSource.transaction(async (manager: EntityManager) => {
      if (refund) {
        await this.transactionsService.refundExpertFault(dispute.bountyId, manager);
        await this.bountiesService.markRefundedAfterDispute(dispute.bountyId, manager);
        dispute.status = DisputeStatus.RESOLVED_REFUND;
      } else {
        // approve()는 SUBMITTED 상태를 요구하므로, 분쟁 중 정산은 별도 헬퍼로 상태만 SETTLED 전환
        await this.transactionsService.settleNormally(dispute.bountyId, expert!, manager);
        await this.bountiesService.markSettledAfterDispute(dispute.bountyId, manager);
        dispute.status = DisputeStatus.RESOLVED_SETTLE;
      }
      dispute.adminActionLog = adminNote;
      return manager.getRepository(Dispute).save(dispute);
    });

    const resultMessage = refund
      ? `"${bounty.title}" 프로젝트 분쟁이 의뢰인 환불로 종결되었습니다.`
      : `"${bounty.title}" 프로젝트 분쟁이 전문가 정산 유지로 종결되었습니다.`;
    await this.notificationsService.notify(
      bounty.clientId,
      NotificationType.DISPUTE_RESOLVED,
      resultMessage,
      bounty.id,
    );
    if (bounty.assignedExpertId) {
      await this.notificationsService.notify(
        bounty.assignedExpertId,
        NotificationType.DISPUTE_RESOLVED,
        resultMessage,
        bounty.id,
      );
    }
    return saved;
  }
}
