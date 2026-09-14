import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Bounty } from './bounty.entity';

/**
 * 기획서 8장 SUBMITTED 단계 "전문가가 제출하는 것 = 검증된 결과물 + 증빙" 및
 * 9장에서 언급되는 artifacts 테이블에 해당.
 * ERD 다이어그램(10장)에는 별도 표기가 없었지만 55페이지 "artifacts, disputes,
 * admin_audit_logs에 분쟁과 관리자 조치를 기록" 문장에서 존재가 전제되어 있어 추가했다.
 */
@Entity('bounty_submissions')
export class BountySubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Bounty, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bounty_id' })
  bounty: Bounty;

  @Column({ name: 'bounty_id' })
  bountyId: string;

  // Mock S3 Pre-signed URL 업로드 결과. 실제 파일 바이트는 로컬 uploads 폴더에 저장(MockStorageService).
  @Column()
  fileUrl: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn()
  createdAt: Date;
}
