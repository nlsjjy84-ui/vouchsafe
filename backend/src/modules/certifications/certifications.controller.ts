import {
  Body,
  Controller,
  Get,
  Inject,
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
import { ReviewCertificationDto } from './dto/review-certification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../common/enums/user-role.enum';
import { STORAGE_SERVICE, StorageService } from '../../storage/storage.interface';
import { EVIDENCE_MAX_BYTES } from '../../storage/upload-limits.const';

/**
 * =========================================================================
 * CertificationsController — 전문가 자격 인증 신청/조회/관리자 검토
 * =========================================================================
 * 기획서 3장 "전문가 등록은 4개의 증빙 트랙으로 나뉜다"에 대응.
 * 여기서 승인(APPROVED)된 기록이 있어야 해당 도메인의 프로젝트에 지원할 수 있다
 * (그 검사는 BountiesService.apply에서 한다).
 * =========================================================================
 */
@ApiTags('certifications')
@ApiBearerAuth('JWT-auth')
@Controller('certifications')
@UseGuards(JwtAuthGuard)
export class CertificationsController {
  constructor(
    private readonly certificationsService: CertificationsService,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {}

  /**
   * 자격 인증 신청
   * POST /api/certifications (multipart/form-data)
   *   - domainType: 15개 도메인 중 하나
   *   - track: 4개 증빙 트랙 중 하나
   *   - licenseNumber: 트랙에 맞는 증빙 번호 (자격증 번호/사업자번호 등)
   *   - evidenceFile: 증빙 서류 파일 (선택, 있으면 저장)
   *
   * MockVerificationService가 형식검증 + OCR 대조(SHA-256 시드, 85% 자동판정) 2단계로
   * 즉시 승인/반려하거나, 신뢰도가 낮은 15%는 PENDING으로 남겨 관리자 수동검토로 넘긴다.
   */
  // Security 2탄: limits.fileSize를 걸어두면 multer가 요청 바디를 스트림으로 받는 도중
  // 이 한도를 넘는 순간 즉시 요청을 끊는다 — 파일을 다 받은 뒤에 거부하는 게 아니라
  // 애초에 그만큼도 받지 않고 차단하는 것이라, 큰 파일을 고의로 보내도 응답이 거의 즉시 온다.
  @Post()
  @UseInterceptors(
    FileInterceptor('evidenceFile', {
      storage: memoryStorage(),
      limits: { fileSize: EVIDENCE_MAX_BYTES },
    }),
  )
  async submit(
    @CurrentUser() user: { userId: string },
    @Body() dto: SubmitCertificationDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const evidenceFileUrl = file
      ? await this.storageService.saveFile(file.originalname, file.buffer, EVIDENCE_MAX_BYTES)
      : undefined;
    return this.certificationsService.submit(user.userId, dto, evidenceFileUrl);
  }

  /** 내가 신청한 인증 내역 전체 조회. GET /api/certifications/me */
  @Get('me')
  findMine(@CurrentUser() user: { userId: string }) {
    return this.certificationsService.findMine(user.userId);
  }

  /** [관리자] OCR 신뢰도가 낮아 PENDING으로 남은 건 목록. GET /api/certifications/pending-review */
  @Get('pending-review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  listPendingReview() {
    return this.certificationsService.listPendingReview();
  }

  /** [관리자] 수동검토 승인/반려. POST /api/certifications/:id/review body: { approved, note } */
  @Post(':id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  review(@Param('id') id: string, @Body() dto: ReviewCertificationDto) {
    return this.certificationsService.review(id, dto.approved, dto.note);
  }
}
