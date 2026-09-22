import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { BountiesService } from './bounties.service';
import { SettlementSchedulerService } from './settlement-scheduler.service';
import { SafeNumberService } from '../safe-number/safe-number.service';
import { CreateBountyDto } from './dto/create-bounty.dto';
import { ApplyBountyDto } from './dto/apply-bounty.dto';
import { RateBountyDto } from './dto/rate-bounty.dto';
import { CreateMilestonesDto } from './dto/create-milestones.dto';
import { SubmitMilestoneDto } from './dto/submit-milestone.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../common/enums/user-role.enum';
import { DomainType } from '../../common/enums/domain-type.enum';
import { BountyStatus } from '../../common/enums/bounty-status.enum';
import { STORAGE_SERVICE, StorageService } from '../../storage/storage.interface';
import { SUBMISSION_MAX_BYTES } from '../../storage/upload-limits.const';

/**
 * =========================================================================
 * BountiesController
 * =========================================================================
 * "컨트롤러"는 프론트엔드(화면)에서 오는 HTTP 요청을 제일 먼저 받는 창구다.
 * 여기서는 요청을 해석해서 실제 판단/저장 로직을 담당하는 BountiesService에게
 * 넘기기만 하고, 복잡한 규칙은 절대 여기 직접 쓰지 않는다 (그건 서비스 몫).
 *
 * 클래스 위의 @Controller('bounties')는 "이 컨트롤러의 모든 주소는
 * /api/bounties 로 시작한다"는 뜻이고, @UseGuards(JwtAuthGuard)는
 * "로그인(JWT 토큰)이 없으면 이 컨트롤러의 어떤 요청도 통과시키지 않는다"는 뜻이다.
 * =========================================================================
 */

// 로그인한 사용자 정보(JwtStrategy가 토큰에서 뽑아낸 값)의 타입.
// userId/email/role 세 가지만 필요해서 여기서 간단히 타입을 정의해 재사용한다.
type AuthUser = { userId: string; email: string; role: string };

@ApiTags('bounties')
@ApiBearerAuth('JWT-auth')
@Controller('bounties')
@UseGuards(JwtAuthGuard)
export class BountiesController {
  constructor(
    private readonly bountiesService: BountiesService,
    private readonly settlementScheduler: SettlementSchedulerService,
    private readonly safeNumberService: SafeNumberService,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {}

  /**
   * [의뢰인] 프로젝트 등록
   * POST /api/bounties
   * body: { domainType, title, description, bountyAmount }
   * 로그인한 사람이 곧 이 프로젝트의 의뢰인(client)이 된다.
   */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBountyDto) {
    return this.bountiesService.create(user.userId, dto);
  }

  /**
   * 프로젝트 목록 조회 (누구나 로그인만 하면 볼 수 있음)
   * GET /api/bounties?domainType=BACKEND_DB_TUNING&status=PENDING
   * 쿼리 파라미터는 둘 다 선택사항 - 아무것도 안 넘기면 전체 목록을 최신순으로 준다.
   */
  @Get()
  findAll(
    @Query('domainType') domainType?: DomainType,
    @Query('status') status?: BountyStatus,
  ) {
    return this.bountiesService.findAll({ domainType, status });
  }

  /** 프로젝트 상세 조회. GET /api/bounties/:id */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bountiesService.findOneOrThrow(id);
  }

  /**
   * [전문가] 프로젝트에 지원
   * POST /api/bounties/:id/apply
   * 서비스 레이어에서 "이 도메인에 대해 승인된 자격증이 있는지"를 검사한다.
   * (자격이 없으면 여기까지 오지 않고 403 에러가 난다 - BountiesService.apply 참고)
   */
  @Post(':id/apply')
  apply(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ApplyBountyDto,
  ) {
    return this.bountiesService.apply(id, user.userId, dto);
  }

  /** [의뢰인] 이 프로젝트에 지원한 전문가 목록 확인. GET /api/bounties/:id/applicants */
  @Get(':id/applicants')
  listApplicants(@Param('id') id: string) {
    return this.bountiesService.listApplicants(id);
  }

  /**
   * [의뢰인] 지원자 중 한 명을 최종 선택
   * POST /api/bounties/:id/select/:applicationId
   * 이 요청 한 번으로 여러 일이 한꺼번에 일어난다:
   *   1) 선택된 지원자는 SELECTED, 나머지 지원자는 자동으로 REJECTED 처리
   *   2) 프로젝트 상태가 PENDING → LOCKED 로 바뀜
   *   3) 에스크로(Mock)에 돈이 잠김 (실제로는 여기서 오픈뱅킹 출금이 일어날 자리)
   * 자세한 순서는 BountiesService.selectApplicant 참고.
   */
  @Post(':id/select/:applicationId')
  selectApplicant(
    @Param('id') id: string,
    @Param('applicationId') applicationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bountiesService.selectApplicant(id, applicationId, user.userId);
  }

  /**
   * [의뢰인] 결제 확인 (Task #14). POST /api/bounties/:id/confirm-payment
   * 프론트가 포트원 결제창을 통과한 직후 호출한다 - 서버가 PG에 직접 재확인한
   * 뒤에야 에스크로가 잠기고 프로젝트가 LOCKED로 넘어간다 (BountiesService.confirmPayment 참고).
   */
  @Post(':id/confirm-payment')
  confirmPayment(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.bountiesService.confirmPayment(id, user.userId);
  }

  /**
   * [전문가] 결과물 제출 (파일 업로드)
   * POST /api/bounties/:id/submit (multipart/form-data)
   *   - resultFile: 실제 결과물 파일 (코드 zip, 진단서 PDF 등)
   *   - note: 어떤 작업을 했는지 짧은 설명
   *
   * FileInterceptor: NestJS가 파일 업로드를 처리해주는 부품. storage: memoryStorage()는
   * "디스크에 임시로 쓰지 말고 메모리(buffer)에 잠깐 들고 있어라"는 뜻 -
   * 그 buffer를 MockStorageService가 검증(확장자/용량)한 뒤 진짜 파일로 저장한다.
   */
  // Security 2탄: 결과물은 증빙(15MB)보다 여유를 두되 20MB로 상한을 명확히 분리하고,
  // limits.fileSize로 multer 스트림 단계에서부터 차단한다 (증빙 업로드와 동일한 원칙).
  @Post(':id/submit')
  @UseInterceptors(
    FileInterceptor('resultFile', {
      storage: memoryStorage(),
      limits: { fileSize: SUBMISSION_MAX_BYTES },
    }),
  )
  async submitResult(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body('note') note: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // 파일을 첨부하지 않고 요청을 보내면 file이 undefined다.
    // 여기서 미리 막지 않으면 file.originalname에서 예외가 터져
    // "Internal server error(500)"라는 불친절한 메시지가 나가버린다.
    // → 원인을 바로 알 수 있는 400 에러로 바꿔서 클라이언트가 대응할 수 있게 한다.
    if (!file) {
      throw new BadRequestException('결과 파일(resultFile)을 첨부해주세요.');
    }
    const fileUrl = await this.storageService.saveFile(
      file.originalname,
      file.buffer,
      SUBMISSION_MAX_BYTES,
    );
    return this.bountiesService.submitResult(id, user.userId, fileUrl, note);
  }

  /** 제출된 결과물 목록 조회. GET /api/bounties/:id/submissions */
  @Get(':id/submissions')
  getSubmissions(@Param('id') id: string) {
    return this.bountiesService.getSubmissions(id);
  }

  /**
   * [의뢰인] 결과물 승인 → 정산
   * POST /api/bounties/:id/approve
   * 승인하는 순간 플랫폼 수수료를 뗀 금액이 전문가에게 정산(Mock)되고,
   * 프로젝트 상태가 SUBMITTED → SETTLED 로 바뀐다. (거래 완전 종료)
   */
  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.bountiesService.approve(id, user.userId);
  }

  /**
   * [의뢰인] 공개 거래 사례용 평가 등록 (정산 완료 후 1회).
   * POST /api/bounties/:id/rate  body: { rating: 1.0~10.0 (0.5단위), note?: string }
   */
  @Post(':id/rate')
  rate(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: RateBountyDto) {
    return this.bountiesService.rate(id, user.userId, dto);
  }

  // =========================================================================
  // 마일스톤 분할 정산 (Phase 2) — 큰 프로젝트를 여러 단계로 나눠 단계별로 부분 정산한다.
  // 일반 submit/approve와는 별개 흐름이라, LOCKED 직후 마일스톤을 정의한 프로젝트는
  // 이후 이 API들만 사용한다.
  // =========================================================================

  /** [의뢰인] 마일스톤 정의. POST /api/bounties/:id/milestones body: { milestones: [{title, amount}, ...] } */
  @Post(':id/milestones')
  createMilestones(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMilestonesDto,
  ) {
    return this.bountiesService.createMilestones(id, user.userId, dto);
  }

  /** 마일스톤 목록 조회. GET /api/bounties/:id/milestones */
  @Get(':id/milestones')
  listMilestones(@Param('id') id: string) {
    return this.bountiesService.listMilestones(id);
  }

  /** [전문가] 마일스톤 제출. POST /api/bounties/:id/milestones/:milestoneId/submit */
  @Post(':id/milestones/:milestoneId/submit')
  submitMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitMilestoneDto,
  ) {
    return this.bountiesService.submitMilestone(id, milestoneId, user.userId, dto.note);
  }

  /** [의뢰인] 마일스톤 승인 → 그 몫만큼 즉시 부분 정산. POST /api/bounties/:id/milestones/:milestoneId/approve */
  @Post(':id/milestones/:milestoneId/approve')
  approveMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bountiesService.approveMilestone(id, milestoneId, user.userId);
  }

  /**
   * [의뢰인/전문가] 동행(COMPANION) 서비스 안심번호 조회 (없으면 즉시 발급).
   * GET /api/bounties/:id/safe-number
   * 실제 전화번호 대신 서로의 안심번호(Mock 가상번호)를 알려준다.
   */
  @Get(':id/safe-number')
  async getSafeNumber(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const bounty = await this.bountiesService.findOneOrThrow(id);
    return this.safeNumberService.getOrCreateForBounty(bounty, user.userId);
  }

  /**
   * [관리자] 무이의 기간 만료 자동 정산 수동 트리거.
   * POST /api/bounties/settlement/run-now
   * 평소에는 SettlementSchedulerService가 매시 자동으로 돌지만, 관리자가 즉시 한 번
   * 돌려보고 싶을 때(장애 복구, 수동 확인 등) 쓰는 관리자 전용 엔드포인트.
   */
  @Post('settlement/run-now')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  runSettlementNow() {
    return this.settlementScheduler.runAutoSettlement();
  }
}
