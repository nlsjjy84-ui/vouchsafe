import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { DomainType } from '../../../common/enums/domain-type.enum';
import {
  VerificationStatus,
  VerificationTrack,
} from '../../../common/enums/verification-track.enum';

/**
 * 기획서 10장 Certifications(자격 및 인증 닥) + 3장 4개 증빙 트랙.
 *
 * verifiedStatus가 APPROVED가 되어야만 해당 domainType 바운티에 지원할 수 있다
 * (BountiesService.applyToBounty 에서 이 테이블을 조회해 검사).
 */
@Entity('certifications')
export class Certification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.certifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: DomainType })
  domainType: DomainType;

  @Column({ type: 'enum', enum: VerificationTrack })
  track: VerificationTrack;

  // 트랙별로 의미가 다름: 자격증 번호 / 사업자등록번호 / 재직증명 문서번호 / 채널 URL 등
  @Column()
  licenseNumber: string;

  // Mock S3 업로드 결과 경로. 실제로는 Pre-signed URL로 업로드된 오브젝트 키가 들어간다.
  @Column({ nullable: true })
  evidenceFileUrl: string;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  verifiedStatus: VerificationStatus;

  // 관리자가 반려했을 때 사유를 남겨 재제출 시 참고할 수 있게 한다.
  @Column({ nullable: true })
  reviewNote: string;

  @CreateDateColumn()
  createdAt: Date;
}
