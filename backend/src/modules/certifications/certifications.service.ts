import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certification } from './entities/certification.entity';
import { SubmitCertificationDto } from './dto/submit-certification.dto';
import { MockVerificationService } from '../../mocks/mock-verification.service';
import { VerificationStatus } from '../../common/enums/verification-track.enum';
import { DomainType } from '../../common/enums/domain-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../common/enums/notification-type.enum';

@Injectable()
export class CertificationsService {
  constructor(
    @InjectRepository(Certification)
    private readonly certificationRepository: Repository<Certification>,
    private readonly mockVerification: MockVerificationService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * 기획서 3장 "공통 원칙: 증빙 제출 → 외부/관리자 대조 → 객관적 입증 시 권한 부여".
   * Mock 단계에서는 MockVerificationService가 형식검증 + OCR 대조(SHA-256 시드) 2단계로
   * 즉시 APPROVED/REJECTED를 결정하거나, OCR 신뢰도가 낮으면(15%) PENDING으로 남겨
   * 관리자 수동검토(review())로 넘긴다.
   */
  async submit(userId: string, dto: SubmitCertificationDto, evidenceFileUrl?: string) {
    const result = await this.mockVerification.verifyCertification(dto.licenseNumber);

    const certification = this.certificationRepository.create({
      userId,
      domainType: dto.domainType,
      track: dto.track,
      licenseNumber: dto.licenseNumber,
      evidenceFileUrl,
      verifiedStatus: VerificationStatus[result.status],
      reviewNote: result.note,
    });
    const saved = await this.certificationRepository.save(certification);

    await this.notificationsService.notify(
      userId,
      NotificationType.CERTIFICATION_REVIEWED,
      result.status === 'PENDING'
        ? `${dto.domainType} 자격 인증이 관리자 수동검토 대기 중입니다.`
        : `${dto.domainType} 자격 인증이 ${result.status === 'APPROVED' ? '승인' : '반려'}되었습니다.`,
    );

    return saved;
  }

  findMine(userId: string) {
    return this.certificationRepository.find({ where: { userId } });
  }

  /** [관리자] OCR 신뢰도 낮음(PENDING)으로 넘어온 건을 수동으로 승인/반려한다 */
  async review(id: string, approved: boolean, note: string) {
    const cert = await this.findByIdOrThrow(id);
    if (cert.verifiedStatus !== VerificationStatus.PENDING) {
      throw new BadRequestException('수동검토 대기(PENDING) 상태인 건만 심사할 수 있습니다');
    }
    cert.verifiedStatus = approved ? VerificationStatus.APPROVED : VerificationStatus.REJECTED;
    cert.reviewNote = `[관리자 수동검토] ${note}`;
    const saved = await this.certificationRepository.save(cert);

    await this.notificationsService.notify(
      cert.userId,
      NotificationType.CERTIFICATION_REVIEWED,
      `${cert.domainType} 자격 인증이 관리자 검토 결과 ${approved ? '승인' : '반려'}되었습니다.`,
    );
    return saved;
  }

  listPendingReview() {
    return this.certificationRepository.find({
      where: { verifiedStatus: VerificationStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
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
