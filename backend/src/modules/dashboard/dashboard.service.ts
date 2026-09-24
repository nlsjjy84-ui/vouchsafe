import { Injectable } from '@nestjs/common';
import { BountiesService } from '../bounties/bounties.service';
import { CertificationsService } from '../certifications/certifications.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { ApplicationStatus } from '../bounties/entities/bounty-application.entity';
import { BountyStatus } from '../../common/enums/bounty-status.enum';
import { VerificationStatus } from '../../common/enums/verification-track.enum';

// "진행중"으로 취급할 프로젝트 상태 (등록만 해둔 PENDING과, 이미 끝난
// SETTLED는 제외 - 프론트 SummaryTile "진행중" 항목과 맞춘 기준).
const IN_PROGRESS_STATUSES: BountyStatus[] = [
  BountyStatus.LOCKED,
  BountyStatus.SUBMITTED,
  BountyStatus.DISPUTED,
];

/**
 * =========================================================================
 * DashboardModule (기획서: "마이페이지 대시보드 — 순환참조 없이 4개 모듈 조립")
 * =========================================================================
 * 이 서비스는 새로운 비즈니스 로직을 만들지 않는다. 이미 각자 검증된
 * BountiesModule / CertificationsModule / UsersModule / NotificationsModule
 * 네 모듈의 조회용 메서드만, 프론트엔드 마이페이지(mypage/page.tsx,
 * lib/types.ts의 MyDashboard)가 기대하는 { profile, summary, clientBounties,
 * expertApplications, certifications } 형태로 조립해서 내려준다.
 * =========================================================================
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly bountiesService: BountiesService,
    private readonly certificationsService: CertificationsService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  async getMyDashboard(userId: string) {
    const [user, clientBounties, expertApplications, certifications, unreadCount] =
      await Promise.all([
        this.usersService.findById(userId),
        this.bountiesService.findMyAsClient(userId, 10),
        this.bountiesService.findMyApplications(userId, 10),
        this.certificationsService.findMine(userId),
        this.notificationsService.countUnread(userId),
      ]);

    return {
      profile: user && {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt,
      },
      summary: {
        clientBountyCount: clientBounties.length,
        clientBountyInProgressCount: clientBounties.filter((b) =>
          IN_PROGRESS_STATUSES.includes(b.status),
        ).length,
        expertApplicationCount: expertApplications.length,
        expertSelectedCount: expertApplications.filter(
          (a) => a.status === ApplicationStatus.SELECTED,
        ).length,
        certificationApprovedCount: certifications.filter(
          (c) => c.verifiedStatus === VerificationStatus.APPROVED,
        ).length,
        unreadNotificationCount: unreadCount,
      },
      clientBounties,
      expertApplications,
      certifications,
    };
  }
}
