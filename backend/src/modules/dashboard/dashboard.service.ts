import { Injectable } from '@nestjs/common';
import { BountiesService } from '../bounties/bounties.service';
import { CertificationsService } from '../certifications/certifications.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReputationService } from '../users/reputation.service';

/**
 * =========================================================================
 * DashboardModule (기획서: "마이페이지 대시보드 — 순환참조 없이 4개 모듈 조립")
 * =========================================================================
 * 이 서비스는 새로운 비즈니스 로직을 만들지 않는다. 이미 각자 검증된
 * BountiesModule / CertificationsModule / UsersModule(ReputationService) /
 * NotificationsModule 네 모듈의 조회용 메서드만 한 화면(마이페이지)에 맞게
 * 묶어서 보여주는 "조립" 역할만 한다 — 그래서 순환참조가 생기지 않는다:
 * DashboardModule → (Bounties/Certifications/Users/Notifications)는 모두
 * 단방향이고, 저 네 모듈은 DashboardModule을 알지 못한다.
 * =========================================================================
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly bountiesService: BountiesService,
    private readonly certificationsService: CertificationsService,
    private readonly notificationsService: NotificationsService,
    private readonly reputationService: ReputationService,
  ) {}

  async getMyDashboard(userId: string) {
    const [myBounties, myCertifications, recentNotifications, unreadCount, reputation] =
      await Promise.all([
        this.bountiesService.findMine(userId, 10),
        this.certificationsService.findMine(userId),
        this.notificationsService.findMine(userId, 5),
        this.notificationsService.countUnread(userId),
        this.reputationService.getExpertReputation(userId),
      ]);

    return {
      bounties: myBounties,
      certifications: myCertifications,
      notifications: {
        unreadCount,
        recent: recentNotifications,
      },
      reputation,
    };
  }
}
