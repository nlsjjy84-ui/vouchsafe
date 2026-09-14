import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CertificationsService } from './certifications.service';
import { SubmitCertificationDto } from './dto/submit-certification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StorageService } from '../../mocks/storage.interface';
import { MAX_CERTIFICATION_EVIDENCE_SIZE_BYTES } from '../../mocks/file-validation.util';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../common/enums/user-role.enum';

type AuthUser = { userId: string };

/**
 * =========================================================================
 * CertificationsController — 전문가 자격 인증 신청/조회
 * =========================================================================
 * 기획서 3장 "전문가 등록은 4개의 증빙 트랙으로 나뉜다"에 대응.
 * 여기서 승인(APPROVED)된 기록이 있어야 해당 도메인의 바운티에 지원할 수 있다
 * (그 검사는 BountiesService.apply에서 한다).
 * =========================================================================
 */
@ApiTags('certifications')
@ApiBearerAuth('access-token')
@Controller('certifications')
@UseGuards(JwtAuthGuard)
export class CertificationsController {
  constructor(
    private readonly certificationsService: CertificationsService,
    // MockStorageService가 아니라 StorageService "인터페이스"에 의존한다.
    // 실제 구현체(Mock 또는 S3)는 mocks.module.ts가 대신 골라서 주입해준다 —
    // 이 컨트롤러는 지금 어떤 구현체가 쓰이고 있는지 전혀 몰라도 된다.
    private readonly storageService: StorageService,
  ) {}

  /**
   * 자격 인증 신청
   * POST /api/certifications (multipart/form-data)
   *   - domainType: 15개 도메인 중 하나
   *   - track: 4개 증빙 트랙 중 하나
   *   - licenseNumber: 트랙에 맞는 증빙 번호 (자격증 번호/사업자번호 등)
   *   - evidenceFile: 증빙 서류 파일 (선택, 있으면 저장 + AI OCR Mock으로 자동 대조)
   *
   * 형식 검증(MockVerificationService) → (파일 첨부 시) AI OCR Mock 자동 대조까지
   * 거쳐 승인/반려/보류(PENDING)가 결정된다. 자세한 단계는 CertificationsService.submit 참고.
   */
  @Post()
  @UseInterceptors(
    FileInterceptor('evidenceFile', {
      storage: memoryStorage(),
      // [보안 강화] validateUploadedFile()이 "다 받은 뒤" 용량을 검사하기 전에,
      // multer 자체가 스트림 단계에서 이 크기를 넘는 순간 바로 끊어버리게 한다 -
      // 안 그러면 아주 큰 파일을 고의로 보냈을 때 거부되기 전까지 이미 메모리에
      // 전부 올라가버리는 부담이 생긴다.
      limits: { fileSize: MAX_CERTIFICATION_EVIDENCE_SIZE_BYTES },
    }),
  )
  async submit(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitCertificationDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // saveFile이 실제 S3 구현체일 때는 네트워크 호출이라 반드시 await 해야 한다.
    const evidenceFileUrl = file
      ? await this.storageService.saveFile(file.originalname, file.buffer, MAX_CERTIFICATION_EVIDENCE_SIZE_BYTES)
      : undefined;
    return this.certificationsService.submit(user.userId, dto, evidenceFileUrl, file?.buffer);
  }

  /** 내가 신청한 인증 내역 전체 조회. GET /api/certifications/me */
  @Get('me')
  findMine(@CurrentUser() user: AuthUser) {
    return this.certificationsService.findMine(user.userId);
  }

  /**
   * [관리자] AI 자동 심사가 보류(PENDING)한 신청 대기열 조회
   * GET /api/certifications/pending
   */
  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findPending() {
    return this.certificationsService.findPending();
  }

  /**
   * [관리자] 보류 중인 인증 신청을 최종 승인/반려
   * POST /api/certifications/:id/review
   * body: { approved: true|false, note: "판단 근거" }
   */
  @Post(':id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  review(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body('approved') approved: boolean,
    @Body('note') note: string,
  ) {
    return this.certificationsService.review(id, user.userId, approved, note);
  }
}
