import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationType } from '../../common/enums/notification-type.enum';

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

  findMine(userId: string, limit = 20) {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  countUnread(userId: string) {
    return this.notificationRepository.count({ where: { userId, read: false } });
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.notificationRepository.update({ id, userId }, { read: true });
  }
}
