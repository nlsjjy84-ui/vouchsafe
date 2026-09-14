import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';

/**
 * 지금 앱에서 실제로 발생하는 알림 종류. 새 알림을 추가할 때는 여기에 값을
 * 하나 늘리고, 실제로 notify()를 호출할 지점(BountiesService/DisputesService/
 * CertificationsService 등)에 한 줄 추가하면 된다.
 */
export type NotificationType =
  | 'APPLICATION_SELECTED'
  | 'APPLICATION_REJECTED'
  | 'PAYMENT_LOCKED'
  | 'SUBMISSION_RECEIVED'
  | 'BOUNTY_SETTLED'
  | 'MILESTONE_SETTLED'
  | 'DISPUTE_FILED'
  | 'DISPUTE_RESOLVED'
  | 'CERTIFICATION_APPROVED'
  | 'CERTIFICATION_REJECTED';

/**
 * =========================================================================
 * NotificationsService — 알림 생성/조회/읽음 처리
 * =========================================================================
 * AuditService와 마찬가지로 "부가 기록"에 해당하는 서비스라, notify() 호출
 * 실패가 원래 하려던 핵심 작업(지원자 선택, 결제 확인 등)을 막으면 안 된다.
 * 그래서 이 서비스의 notify()는 항상 각 호출부에서 "메인 DB 트랜잭션이 커밋된
 * 뒤에" 별도로 호출하고, 만에 하나 실패해도 예외를 위로 던지지 않고 로그만
 * 남긴다 (알림 하나 못 남겼다고 바운티 선택 자체가 실패한 것처럼 보이면 안 된다).
 * =========================================================================
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
    title: string,
    message: string,
    relatedBountyId?: string | null,
  ): Promise<void> {
    try {
      const notification = this.notificationRepository.create({
        userId,
        type,
        title,
        message,
        relatedBountyId: relatedBountyId ?? null,
      });
      await this.notificationRepository.save(notification);
    } catch (err) {
      this.logger.warn(`알림 생성 실패 (원래 작업에는 영향 없음) userId=${userId} type=${type}: ${(err as Error).message}`);
    }
  }

  findMine(userId: string) {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  countUnread(userId: string) {
    return this.notificationRepository.count({ where: { userId, isRead: false } });
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({ where: { id } });
    if (!notification) throw new NotFoundException('알림을 찾을 수 없습니다');
    if (notification.userId !== userId) {
      throw new ForbiddenException('본인에게 온 알림만 읽음 처리할 수 있습니다');
    }
    if (!notification.isRead) {
      notification.isRead = true;
      await this.notificationRepository.save(notification);
    }
    return notification;
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationRepository.update({ userId, isRead: false }, { isRead: true });
    return { updated: result.affected ?? 0 };
  }
}
