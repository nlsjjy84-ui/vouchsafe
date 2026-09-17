import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationType } from '../../common/enums/notification-type.enum';

/**
 * 프론트(lib/types.ts AppNotification)가 기대하는 "제목" 문구 - 엔티티에는
 * title 컬럼이 없어서(그냥 message 문장 하나만 저장) 응답을 만들 때 type으로부터
 * 계산해서 붙여준다. DB 마이그레이션 없이 프론트 계약을 맞추는 가장 가벼운 방법.
 */
const NOTIFICATION_TITLE_MAP: Record<NotificationType, string> = {
  [NotificationType.BOUNTY_APPLICATION_RECEIVED]: '새 지원자가 도착했어요',
  [NotificationType.BOUNTY_SELECTED]: '바운티에 선정됐어요',
  [NotificationType.BOUNTY_SUBMITTED]: '결과물이 제출됐어요',
  [NotificationType.BOUNTY_SETTLED]: '정산이 완료됐어요',
  [NotificationType.BOUNTY_AUTO_SETTLED]: '무이의 기간 만료로 자동 정산됐어요',
  [NotificationType.MILESTONE_SETTLED]: '마일스톤이 정산됐어요',
  [NotificationType.DISPUTE_FILED]: '이의제기가 접수됐어요',
  [NotificationType.DISPUTE_RESOLVED]: '분쟁 중재 결과가 나왔어요',
  [NotificationType.CERTIFICATION_REVIEWED]: '자격 인증 심사 결과가 나왔어요',
};

/**
 * 인앱 알림 발송/조회.
 *
 * 핵심 설계 원칙: notify()는 절대 예외를 던지지 않는다. 정산·이의제기·마일스톤 승인 같은
 * 핵심 로직 중간에 "알림 보내기"를 끼워 넣는데, 만약 알림 저장이 실패했다고 해서 이미
 * 커밋된 정산까지 실패한 것처럼 보이면 안 되기 때문이다 (그리고 이 메서드는 대부분
 * DataSource.transaction() 콜백 "밖"에서, 트랜잭션이 커밋된 뒤 호출된다 — 알림 실패가
 * 거래 자체의 롤백 사유가 되어서는 안 되므로 의도적으로 트랜잭션에 포함시키지 않는다).
 * 호출하는 쪽은 그냥 await만 하면 되고, try/catch를 따로 감쌀 필요가 없다.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async notify(
    userId: string,
    type: NotificationType,
    message: string,
    relatedBountyId?: string,
  ): Promise<void> {
    try {
      const notification = this.notificationRepository.create({
        userId,
        type,
        message,
        relatedBountyId: relatedBountyId ?? null,
      });
      await this.notificationRepository.save(notification);
    } catch (err) {
      // 의도적으로 삼킨다 — 알림 실패가 호출자의 핵심 로직을 막아서는 안 된다.
      this.logger.error(
        `알림 저장 실패 (핵심 로직에는 영향 없음): userId=${userId}, type=${type} — ${(err as Error).message}`,
      );
    }
  }

  /**
   * 내 알림 목록. 엔티티 필드(read)와 프론트 계약(isRead)이 이름부터 달라서
   * 그동안 프론트에서 항상 "안읽음"으로만 보였던 문제 - 여기서 변환해서 내려준다.
   * (title도 마찬가지 - NOTIFICATION_TITLE_MAP 참고.)
   */
  async findMine(userId: string, limit = 20) {
    const rows = await this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: NOTIFICATION_TITLE_MAP[n.type] ?? '알림',
      message: n.message,
      relatedBountyId: n.relatedBountyId,
      isRead: n.read,
      createdAt: n.createdAt,
    }));
  }

  countUnread(userId: string) {
    return this.notificationRepository.count({ where: { userId, read: false } });
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.notificationRepository.update({ id, userId }, { read: true });
  }

  /** "모두 읽음 처리" - 안 읽은 알림을 한 번에 전부 읽음 처리한다 (NotificationBell.tsx 참고). */
  async markAllRead(userId: string): Promise<void> {
    await this.notificationRepository.update({ userId, read: false }, { read: true });
  }
}
