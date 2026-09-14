import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Dispute, DisputeStatus } from './entities/dispute.entity';
import { FileDisputeDto } from './dto/file-dispute.dto';
import { BountiesService } from '../bounties/bounties.service';
import { TransactionsService } from '../transactions/transactions.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * 기획서 9장 "DISPUTED: 이의제기가 들어오면 자금부터 동결한다".
 * 판단(관리자 1차 중재)은 지금 단계에서는 관리자 역할 유저가 API로 직접 승인/반려하는
 * 형태로 단순화했다 (실제로는 통화 이력 등 추가 근거가 필요 - Phase 2에서 보강 예정).
 */
@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(Dispute)
    private readonly disputeRepository: Repository<Dispute>,
    private readonly bountiesService: BountiesService,
    private readonly transactionsService: TransactionsService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * [Task #26] "바운티를 DISPUTED로 바꾸기"와 "자금을 FROZEN으로 동결하기"는
   * 반드시 같이 성공하거나 같이 실패해야 한다 - 자금 동결 없이 상태만 DISPUTED가
   * 되면, 그 사이 정산이 먼저 처리되어버릴 수 있는 위험한 경쟁 상태가 생긴다.
   */
  async file(bountyId: string, clientId: string, dto: FileDisputeDto) {
    const bounty = await this.bountiesService.findOneOrThrow(bountyId);
    if (bounty.clientId !== clientId) {
      throw new ForbiddenException('본인이 등록한 바운티에 대해서만 이의제기할 수 있습니다');
    }

    const dispute = await this.dataSource.transaction(async (manager: EntityManager) => {
      // 1) 바운티 상태를 DISPUTED로 전환 (SUBMITTED 상태에서만 가능 - BountiesService에서 검사)
      await this.bountiesService.markDisputed(bountyId, manager);
      // 2) 에스크로 자금 즉시 동결
      await this.transactionsService.freeze(bountyId, manager);

      const created = manager.getRepository(Dispute).create({ bountyId, reason: dto.reason });
      return manager.getRepository(Dispute).save(created);
    });

    // 이의제기는 항상 의뢰인이 접수하므로(위 clientId 검사), 상대방인 전문가에게 알린다.
    if (bounty.assignedExpertId) {
      await this.notificationsService.notify(
        bounty.assignedExpertId,
        'DISPUTE_FILED',
        '이의제기가 접수됐어요',
        `"${bounty.title}" 바운티에 의뢰인이 이의제기를 접수하여 자금이 동결되었습니다.`,
        bountyId,
      );
    }

    return dispute;
  }

  findByBounty(bountyId: string) {
    return this.disputeRepository.find({ where: { bountyId }, order: { createdAt: 'DESC' } });
  }

  /**
   * 관리자 1차 중재 결과 반영.
   * refund=true  → 9장 "전문가 귀책(먹튀) 환불": 의뢰인 전액 환불 + 전문가 자격 제재는 Phase 2
   * refund=false → 전문가 손을 들어줌: 정상 정산 그대로 진행
   */
  /**
   * [Task #26] 환불 또는 정산 처리 + 바운티 상태 전환 + 분쟁 기록 저장까지 하나의
   * 트랜잭션으로 묶는다 - "환불은 됐는데 바운티 상태가 안 바뀐" 예전 버그
   * (PROGRESS.md "REFUNDED 상태 버그" 참고)와 같은 종류의 불일치를 구조적으로
   * 막기 위함이다. 감사 로그(auditService.record)는 의도적으로 트랜잭션 밖에 뒀다 -
   * AuditService 자체 설계가 "로그 기록 실패가 원래 하려던 작업을 막으면 안 된다"는
   * 원칙이라, 분쟁 처리 자체가 이미 커밋된 뒤에 별도로 기록한다.
   */
  async resolve(disputeId: string, adminId: string, adminNote: string, refund: boolean) {
    const dispute = await this.disputeRepository.findOne({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException('분쟁 건을 찾을 수 없습니다');

    const saved = await this.dataSource.transaction(async (manager: EntityManager) => {
      if (refund) {
        await this.transactionsService.refundExpertFault(dispute.bountyId, manager);
        // [버그 수정] 예전에는 여기서 바운티 상태를 안 바꿔서 DISPUTED에 계속 머물러
        // 있었다 — "아직 처리 안 된 분쟁"처럼 보이는 문제. REFUNDED로 명확히 종결시킨다.
        await this.bountiesService.markRefundedAfterDispute(dispute.bountyId, manager);
        dispute.status = DisputeStatus.RESOLVED_REFUND;
      } else {
        const bounty = await this.bountiesService.findOneOrThrow(dispute.bountyId, manager);
        const expert = await this.usersService.findById(bounty.assignedExpertId!);
        if (!expert) throw new NotFoundException('전문가 정보를 찾을 수 없습니다');

        // approve()는 SUBMITTED 상태를 요구하므로, 분쟁 중 정산은 별도 헬퍼로 상태만 SETTLED 전환
        await this.transactionsService.settleNormally(bounty.id, expert, manager);
        await this.bountiesService.markSettledAfterDispute(bounty.id, manager);
        dispute.status = DisputeStatus.RESOLVED_SETTLE;
      }
      dispute.adminActionLog = adminNote;
      return manager.getRepository(Dispute).save(dispute);
    });

    // 기획 확장판 5장 "관리자 감사 로그": 관리자가 내린 판단과 그 근거를 영구 기록한다.
    // 이 기록은 나중에 "이 결정이 왜 내려졌는지" 분쟁이 생겼을 때 근거가 된다.
    await this.auditService.record({
      adminId,
      action: 'DISPUTE_RESOLVE',
      targetType: 'dispute',
      targetId: disputeId,
      detail: `refund=${refund} / 사유: ${adminNote}`,
    });

    // 이의제기 당사자(의뢰인/전문가) 양쪽 모두에게 처리 결과를 알린다.
    const bounty = await this.bountiesService.findOneOrThrow(dispute.bountyId);
    const outcomeMessage = refund
      ? '이의제기가 처리되어 의뢰인에게 환불되었습니다.'
      : '이의제기가 처리되어 전문가에게 정상 정산되었습니다.';
    await this.notificationsService.notify(
      bounty.clientId,
      'DISPUTE_RESOLVED',
      '이의제기가 처리됐어요',
      `"${bounty.title}" 바운티: ${outcomeMessage}`,
      bounty.id,
    );
    if (bounty.assignedExpertId) {
      await this.notificationsService.notify(
        bounty.assignedExpertId,
        'DISPUTE_RESOLVED',
        '이의제기가 처리됐어요',
        `"${bounty.title}" 바운티: ${outcomeMessage}`,
        bounty.id,
      );
    }

    return saved;
  }
}
