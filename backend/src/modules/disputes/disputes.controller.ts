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
@ApiBearerAuth('JWT-auth')
@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  /**
   * [의뢰인] 이의제기 접수
   * POST /api/disputes/bounty/:bountyId
   * body: { reason: "왜 문제가 있다고 생각하는지" }
   * 접수되는 즉시 프로젝트 상태는 DISPUTED로, 에스크로 자금은 FROZEN으로 바뀐다.
   */
  @Post('bounty/:bountyId')
  file(
    @Param('bountyId') bountyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: FileDisputeDto,
  ) {
    return this.disputesService.file(bountyId, user.userId, dto);
  }

  /** [의뢰인/담당 전문가] 특정 프로젝트의 이의제기 이력 조회. GET /api/disputes/bounty/:bountyId */
  @Get('bounty/:bountyId')
  findByBounty(@Param('bountyId') bountyId: string, @CurrentUser() user: AuthUser) {
    return this.disputesService.findByBounty(bountyId, user.userId);
  }

  /**
   * [관리자] 처리 대기중(OPEN)인 분쟁 전체 목록. GET /api/disputes/open
   * 관리자 대시보드에서 "지금 판단이 필요한 건"만 모아 보여주기 위함.
   */
  @Get('open')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findOpen() {
    return this.disputesService.findOpenWithBounty();
  }

  /**
   * [관리자] 이의제기 중재 결과 반영
   * POST /api/disputes/:id/resolve
   * body: { adminNote: "판단 근거", refund: true|false }
   *   refund=true  → 의뢰인 전액 환불 (전문가 귀책으로 판단)
   *   refund=false → 정상 정산 진행 (전문가 손을 들어줌)
   *
   * Phase 2: ADMIN 역할만 호출 가능. 클래스 레벨 JwtAuthGuard(로그인 여부)가 먼저 돌고,
   * 그 다음 메서드 레벨 RolesGuard(역할 여부)가 돈다 — 로그인은 했지만 ADMIN이 아니면 403.
   */
  @Post(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  resolve(
    @Param('id') id: string,
    @Body('adminNote') adminNote: string,
    @Body('refund') refund: boolean,
  ) {
    return this.disputesService.resolve(id, adminNote, refund);
  }
}
