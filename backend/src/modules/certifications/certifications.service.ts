import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certification } from './entities/certification.entity';
import { SubmitCertificationDto } from './dto/submit-certification.dto';
import { MockVerificationService } from '../../mocks/mock-verification.service';
import { MockOcrService } from '../../mocks/mock-ocr.service';
import { VerificationStatus } from '../../common/enums/verification-track.enum';
import { DomainType } from '../../common/enums/domain-type.enum';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CertificationsService {
  constructor(
    @InjectRepository(Certification)
    private readonly certificationRepository: Repository<Certification>,
    private readonly mockVerification: MockVerificationService,
    private readonly mockOcr: MockOcrService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * 기획서 3장 "공통 원칙: 증빙 제출 → 외부/관리자 대조 → 객관적 입증 시 권한 부여".
   *
   * 3단계 자동 심사로 구성했다:
   *  1) 형식 검증(MockVerificationService) - 기존과 동일, 자격증 번호 형식 자체가
   *     이상하면 여기서 바로 REJECTED
   *  2) 증빙 서류(evidenceFile)를 첨부하지 않았다면 형식 검증만으로 APPROVED
   *     (자동 서류 대조는 생략됐다는 사실을 reviewNote에 명시)
   *  3) 증빙 서류를 첨부했다면 AI OCR Mock(MockOcrService)이 "서류에서 추출한 글자가
   *     입력한 자격증 번호와 일치하는지"까지 대조 - 일치하면 APPROVED, 불일치하면
   *     자동 승인하지 않고 PENDING(관리자 수동 검토 대기)으로 남긴다. 실제 서비스의
   *     "AI가 애매하면 사람이 최종 판단한다"는 흐름을 그대로 재현한 것.
   */
  async submit(
    userId: string,
    dto: SubmitCertificationDto,
    evidenceFileUrl?: string,
    evidenceFileBuffer?: Buffer,
  ) {
    const formatResult = await this.mockVerification.verifyCertification(dto.licenseNumber);

    let verifiedStatus: VerificationStatus;
    let reviewNote: string;

    if (!formatResult.approved) {
      verifiedStatus = VerificationStatus.REJECTED;
      reviewNote = formatResult.note;
    } else if (!evidenceFileBuffer) {
      verifiedStatus = VerificationStatus.APPROVED;
      reviewNote = `${formatResult.note} / 증빙 서류 미첨부로 AI 자동 서류 대조는 생략되었습니다`;
    } else {
      const ocrResult = await this.mockOcr.extractAndVerify(evidenceFileBuffer, dto.licenseNumber);
      verifiedStatus = ocrResult.matched ? VerificationStatus.APPROVED : VerificationStatus.PENDING;
      reviewNote = `${formatResult.note} / ${ocrResult.note}`;
    }

    const certification = this.certificationRepository.create({
      userId,
      domainType: dto.domainType,
      track: dto.track,
      licenseNumber: dto.licenseNumber,
      evidenceFileUrl,
      verifiedStatus,
      reviewNote,
    });
    return this.certificationRepository.save(certification);
  }

  findMine(userId: string) {
    return this.certificationRepository.find({ where: { userId } });
  }

  /** [관리자] AI 자동 심사가 보류(PENDING)한 신청 목록 - 수동 검토 대기열 */
  findPending() {
    return this.certificationRepository.find({
      where: { verifiedStatus: VerificationStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
  }

  /** [관리자] PENDING 상태 인증 신청을 최종 승인/반려 처리 */
  async review(id: string, adminId: string, approved: boolean, adminNote: string) {
    const cert = await this.findByIdOrThrow(id);
    if (cert.verifiedStatus !== VerificationStatus.PENDING) {
      throw new BadRequestException('AI 자동 심사가 보류한 건만 수동 검토할 수 있습니다');
    }

    cert.verifiedStatus = approved ? VerificationStatus.APPROVED : VerificationStatus.REJECTED;
    cert.reviewNote = `${cert.reviewNote} / [관리자 검토] ${adminNote}`;
    const saved = await this.certificationRepository.save(cert);

    await this.auditService.record({
      adminId,
      action: 'CERTIFICATION_REVIEW',
      targetType: 'certification',
      targetId: id,
      detail: `approved=${approved} / 사유: ${adminNote}`,
    });

    await this.notificationsService.notify(
      cert.userId,
      approved ? 'CERTIFICATION_APPROVED' : 'CERTIFICATION_REJECTED',
      approved ? '자격 인증이 승인됐어요' : '자격 인증이 반려됐어요',
      approved
        ? `제출하신 자격 인증(${cert.domainType})이 관리자 검토를 거쳐 승인되었습니다.`
        : `제출하신 자격 인증(${cert.domainType})이 반려되었습니다. 사유: ${adminNote}`,
    );

    return saved;
  }

  /** BountiesService가 "이 유저가 이 도메인에 지원할 자격이 있는가"를 검사할 때 사용 */
  async hasApprovedCertification(userId: string, domainType: DomainType): Promise<boolean> {
    const found = await this.certificationRepository.findOne({
      where: { userId, domainType, verifiedStatus: VerificationStatus.APPROVED },
    });
    return !!found;
  }

  async findByIdOrThrow(id: string) {
    const cert = await this.certificationRepository.findOne({ where: { id } });
    if (!cert) throw new NotFoundException('인증 신청을 찾을 수 없습니다');
    return cert;
  }
}
