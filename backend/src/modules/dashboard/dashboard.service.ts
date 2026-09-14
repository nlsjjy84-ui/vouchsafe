import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { BountiesService } from '../bounties/bounties.service';
import { CertificationsService } from '../certifications/certifications.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BountyStatus } from '../../common/enums/bounty-status.enum';
import { ApplicationStatus } from '../bounties/entities/bounty-application.entity';
import { VerificationStatus } from '../../common/enums/verification-track.enum';

/**
 * =========================================================================
 * DashboardService — 마이페이지(Task #31) "통합" 대시보드를 위한 조립 계층
 * =========================================================================
 * 왜 별도 모듈로 뺐나?
 *   이 대시보드는 Users/Bounties/Certifications/Notifications 네 도메인의
 *   데이터를 한 화면에 모아 보여준다. 그런데 BountiesModule이 이미
 *   UsersModule을 가져다 쓰고 있어서(선택된 전문가 정보 조회 등), 만약 이
 *   조립 로직을 UsersController에 넣고 UsersModule이 거꾸로 BountiesModule을
 *   가져오면 BountiesModule → UsersModule → BountiesModule 순환 참조가
 *   생긴다. 그래서 아무도 이 모듈을 되돌아 참조할 필요가 없는 새 "리프
 *   상위" 모듈(DashboardModule)을 만들어 네 서비스를 전부 주입받는 방식으로
 *   순환을 피했다.
 *
 *   각 도메인의 실제 조회 로직(필터링, 권한 확인 등)은 전부 해당 도메인의
 *   서비스(BountiesService.findMyBountiesAsClient 등)에 그대로 두고, 여기서는
 *   그 결과들을 "한 번의 API 호출로" 조립해서 내려주는 역할만 한다 - 프론트가
 *   화면 하나를 그리기 위해 여러 번 요청을 보내지 않아도 되게 하기 위함
 *   (frontend는 React Query 같은 캐싱 레이어 없이 단순 useEffect 패턴을 쓰고
 *   있어서, 여러 번의 순차 요청보다 한 번의 집계 응답이 화면 로딩 UX에 더 낫다).
 * =========================================================================
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly usersService: UsersService,
    private readonly bountiesService: BountiesService,
    private readonly certificationsService: CertificationsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getMyDashboard(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      // JWT가 유효해도(세션이 살아있어도) 그 사이 계정이 삭제됐을 가능성은
      // 이론상 남아있다 - 있을 법한 경우는 아니지만 방어적으로 처리.
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    const [clientBounties, expertApplications, certifications, unreadCount] = await Promise.all([
      this.bountiesService.findMyBountiesAsClient(userId),
      this.bountiesService.findMyApplicationsAsExpert(userId),
      this.certificationsService.findMine(userId),
      this.notificationsService.countUnread(userId),
    ]);

    // 화면 상단 요약 카드용 집계. 매번 프론트에서 배열을 순회해 계산하지 않도록
    // 서버가 이미 계산해서 내려준다 - "진행중"의 기준은 아직 최종 상태(정산/환불)에
    // 도달하지 않은 것으로 정의했다.
    const IN_PROGRESS_STATUSES: BountyStatus[] = [
      BountyStatus.PENDING,
      BountyStatus.PAYMENT_PENDING,
      BountyStatus.LOCKED,
      BountyStatus.SUBMITTED,
      BountyStatus.DISPUTED,
    ];

    const summary = {
      clientBountyCount: clientBounties.length,
      clientBountyInProgressCount: clientBounties.filter((b) => IN_PROGRESS_STATUSES.includes(b.status)).length,
      expertApplicationCount: expertApplications.length,
      expertSelectedCount: expertApplications.filter((a) => a.status === ApplicationStatus.SELECTED).length,
      certificationApprovedCount: certifications.filter((c) => c.verifiedStatus === VerificationStatus.APPROVED)
        .length,
      unreadNotificationCount: unreadCount,
    };

    return {
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt,
      },
      summary,
      clientBounties,
      expertApplications,
      certifications,
    };
  }
}
