import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
import { CreateBountyDto } from './dto/create-bounty.dto';
import { ApplyBountyDto } from './dto/apply-bounty.dto';
import { CreateMilestonesDto } from './dto/create-milestones.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DomainType } from '../../common/enums/domain-type.enum';
import { BountyStatus } from '../../common/enums/bounty-status.enum';
import { StorageService } from '../../mocks/storage.interface';
import { MAX_RESULT_FILE_SIZE_BYTES } from '../../mocks/file-validation.util';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

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
@ApiBearerAuth('access-token')
@Controller('bounties')
@UseGuards(JwtAuthGuard)
export class BountiesController {
  constructor(
    private readonly bountiesService: BountiesService,
    // StorageService 인터페이스에만 의존 (실제 구현체 선택은 mocks.module.ts 참고)
    private readonly storageService: StorageService,
  ) {}

  /**
   * [의뢰인] 바운티(일감) 등록
   * POST /api/bounties
   * body: { domainType, title, description, bountyAmount }
   * 로그인한 사람이 곧 이 바운티의 의뢰인(client)이 된다.
   */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBountyDto) {
    return this.bountiesService.create(user.userId, dto);
  }

  /**
   * 바운티 목록 조회 (누구나 로그인만 하면 볼 수 있음)
   * GET /api/bounties?domainType=BACKEND_DB_TUNING&status=PENDING&page=1&limit=12
   * 모든 쿼리 파라미터는 선택사항 - page/limit을 안 넘기면 1페이지/12개 기본값.
   * 응답 형태: { items, total, page, limit, totalPages }
   */
  @Get()
  findAll(
    @Query('domainType') domainType?: DomainType,
    @Query('status') status?: BountyStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.bountiesService.findAll(
      { domainType, status },
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  /** 바운티 상세 조회. GET /api/bounties/:id */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bountiesService.findOneOrThrow(id);
  }

  /**
   * [전문가] 바운티에 지원
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

  /** [의뢰인] 이 바운티에 지원한 전문가 목록 확인. GET /api/bounties/:id/applicants */
  @Get(':id/applicants')
  listApplicants(@Param('id') id: string) {
    return this.bountiesService.listApplicants(id);
  }

  /**
   * [의뢰인] 지원자 중 한 명을 최종 선택
   * POST /api/bounties/:id/select/:applicationId
   * 이 요청 한 번으로 여러 일이 한꺼번에 일어난다:
   *   1) 선택된 지원자는 SELECTED, 나머지 지원자는 자동으로 REJECTED 처리
   *   2) 바운티 상태가 PENDING → PAYMENT_PENDING 으로 바뀜
   *   3) 결제 대기 트랜잭션이 생성되고 paymentId가 발급됨
   * 응답에 담긴 paymentId/amount로 프론트가 실제 결제창(포트원 체크아웃)을 띄운 뒤,
   * 결제가 끝나면 반드시 POST :id/confirm-payment 를 호출해야 에스크로가 락업된다.
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
   * [의뢰인] 결제 완료 확인 → 에스크로 락업
   * POST /api/bounties/:id/confirm-payment
   * 프론트에서 포트원 체크아웃(SDK)으로 결제를 마친 뒤 호출한다. 서버는 프론트의
   * 말을 그대로 믿지 않고 PaymentGatewayService로 PG사에 직접 재확인한 뒤에만
   * 바운티를 PAYMENT_PENDING → LOCKED로 전환한다 (BountiesService.confirmPayment).
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
   * 그 buffer를 StorageService 구현체(Mock 또는 S3)가 검증(확장자/용량)한 뒤 저장한다.
   */
  @Post(':id/submit')
  @UseInterceptors(
    FileInterceptor('resultFile', {
      storage: memoryStorage(),
      // [보안 강화] validateUploadedFile()이 "다 받은 뒤" 용량을 검사하기 전에,
      // multer 자체가 스트림 단계에서 이 크기를 넘는 순간 바로 끊어버리게 한다.
      limits: { fileSize: MAX_RESULT_FILE_SIZE_BYTES },
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
    // saveFile이 실제 S3 구현체일 때는 네트워크 호출이라 반드시 await 해야 한다.
    const fileUrl = await this.storageService.saveFile(file.originalname, file.buffer, MAX_RESULT_FILE_SIZE_BYTES);
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
   * 바운티 상태가 SUBMITTED → SETTLED 로 바뀐다. (거래 완전 종료)
   */
  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.bountiesService.approve(id, user.userId);
  }

  /**
   * [의뢰인] 바운티를 여러 마일스톤으로 분할 정의
   * POST /api/bounties/:id/milestones
   * body: { items: [{ title, amount }, ...] } - amount 합이 바운티 전체 금액과 같아야 함
   * 지원자를 선택하기 전(PENDING) 단계에서만 설정 가능. 자세한 내용은
   * BountiesService.defineMilestones 참고.
   */
  @Post(':id/milestones')
  defineMilestones(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMilestonesDto,
  ) {
    return this.bountiesService.defineMilestones(id, user.userId, dto);
  }

  /** 마일스톤 목록 조회. GET /api/bounties/:id/milestones */
  @Get(':id/milestones')
  listMilestones(@Param('id') id: string) {
    return this.bountiesService.listMilestones(id);
  }

  /**
   * [전문가] 마일스톤 하나의 결과물 제출 (파일 업로드)
   * POST /api/bounties/:id/milestones/:milestoneId/submit (multipart/form-data)
   * submitResult와 동일하게 resultFile/note를 받되, 특정 마일스톤 단위로 제출한다.
   * 순서대로만 제출 가능 (BountiesService.submitMilestone 참고).
   */
  @Post(':id/milestones/:milestoneId/submit')
  @UseInterceptors(
    FileInterceptor('resultFile', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_RESULT_FILE_SIZE_BYTES },
    }),
  )
  async submitMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: AuthUser,
    @Body('note') note: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('결과 파일(resultFile)을 첨부해주세요.');
    }
    const fileUrl = await this.storageService.saveFile(file.originalname, file.buffer, MAX_RESULT_FILE_SIZE_BYTES);
    return this.bountiesService.submitMilestone(id, milestoneId, user.userId, fileUrl, note);
  }

  /**
   * [의뢰인] 마일스톤 하나 승인 → 그 몫만큼 부분 정산
   * POST /api/bounties/:id/milestones/:milestoneId/approve
   * 마지막 마일스톤까지 전부 승인되면 바운티 전체가 SETTLED로 바뀐다.
   */
  @Post(':id/milestones/:milestoneId/approve')
  approveMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bountiesService.approveMilestone(id, milestoneId, user.userId);
  }

  /**
   * [의뢰인/매칭된 전문가] 발급된 안심번호 조회. 아직 발급 전이면 404.
   * GET /api/bounties/:id/safe-number
   */
  @Get(':id/safe-number')
  getSafeNumber(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.bountiesService.getSafeNumber(id, user.userId);
  }

  /**
   * [의뢰인/매칭된 전문가] 안심번호 발급(최초 1회) 또는 기존 번호 조회(멱등).
   * POST /api/bounties/:id/safe-number
   */
  @Post(':id/safe-number')
  createSafeNumber(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.bountiesService.getOrCreateSafeNumber(id, user.userId);
  }

  /**
   * [의뢰인/매칭된 전문가] 안심번호로 "전화 연결"을 흉내낸다 (Mock).
   * POST /api/bounties/:id/safe-number/call
   */
  @Post(':id/safe-number/call')
  callSafeNumber(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.bountiesService.relaySafeNumberCall(id, user.userId);
  }

  /**
   * [관리자 전용] 무이의 기간 만료 자동 정산을 지금 즉시 한 번 실행
   * POST /api/bounties/admin/auto-settle-now
   * 원래는 AutoSettlementScheduler(@Cron)가 매시 정각에 알아서 실행하지만,
   * 관리자가 "지금 바로 확인해보고 싶을 때"(운영 점검, 테스트) 쓸 수 있게
   * 수동 트리거 API도 열어둔다. 스케줄러와 완전히 같은 로직
   * (BountiesService.runAutoSettlementSweep)을 재사용한다.
   */
  @Post('admin/auto-settle-now')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async runAutoSettlementNow() {
    const cutoffDays = Number(process.env.AUTO_SETTLE_DAYS ?? 5);
    const settledCount = await this.bountiesService.runAutoSettlementSweep(cutoffDays);
    return { cutoffDays, settledCount };
  }
}
