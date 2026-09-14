import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DisputesService } from './disputes.service';
import { FileDisputeDto } from './dto/file-dispute.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../common/enums/user-role.enum';

type AuthUser = { userId: string };

/**
 * =========================================================================
 * DisputesController — 이의제기 접수 및 관리자 중재
 * =========================================================================
 * 기획서 9장 "DISPUTED: 이의제기가 들어오면 자금부터 동결한다"에 대응.
 * 결과물이 제출(SUBMITTED)된 뒤 의뢰인이 "이 결과물에 문제가 있다"고 이의를
 * 제기하면, 정산 전에 자금을 먼저 얼려두고(FROZEN) 관리자 판단을 기다린다.
 * =========================================================================
 */
@ApiTags('disputes')
@ApiBearerAuth('access-token')
@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  /**
   * [의뢰인] 이의제기 접수
   * POST /api/disputes/bounty/:bountyId
   * body: { reason: "왜 문제가 있다고 생각하는지" }
   * 접수되는 즉시 바운티 상태는 DISPUTED로, 에스크로 자금은 FROZEN으로 바뀐다.
   */
  @Post('bounty/:bountyId')
  file(
    @Param('bountyId') bountyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: FileDisputeDto,
  ) {
    return this.disputesService.file(bountyId, user.userId, dto);
  }

  /** 특정 바운티의 이의제기 이력 조회. GET /api/disputes/bounty/:bountyId */
  @Get('bounty/:bountyId')
  findByBounty(@Param('bountyId') bountyId: string) {
    return this.disputesService.findByBounty(bountyId);
  }

  /**
   * [관리자] 이의제기 중재 결과 반영
   * POST /api/disputes/:id/resolve
   * body: { adminNote: "판단 근거", refund: true|false }
   *   refund=true  → 의뢰인 전액 환불 (전문가 귀책으로 판단)
   *   refund=false → 정상 정산 진행 (전문가 손을 들어줌)
   *
   * [Phase 2 완료] 관리자(ADMIN) 역할만 호출 가능하도록 RolesGuard로 제한했다.
   * JwtAuthGuard(로그인 여부) → RolesGuard(역할 확인) 순서로 반드시 실행되어야
   * 하므로, 클래스 레벨의 @UseGuards(JwtAuthGuard) 뒤에 메서드 레벨로 RolesGuard를
   * 추가 적용한다. ADMIN이 아닌 사용자가 호출하면 403 Forbidden이 반환된다.
   */
  @Post(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  resolve(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body('adminNote') adminNote: string,
    @Body('refund') refund: boolean,
  ) {
    // 누가(admin) 이 조치를 내렸는지도 감사 로그에 남아야 하므로 user.userId를 함께 넘긴다.
    return this.disputesService.resolve(id, user.userId, adminNote, refund);
  }
}
