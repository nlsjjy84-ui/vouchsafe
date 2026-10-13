import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ExpertOffer } from './expert-offer.entity';

export enum ReportReason {
  OFF_PLATFORM = 'OFF_PLATFORM', // 연락처·직거래 유도
  MISLEADING = 'MISLEADING', // 사실과 다른 내용·자격
  ABUSE = 'ABUSE', // 욕설·도배
  OTHER = 'OTHER',
}

export enum ReportStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

/**
 * 상품·문의 신고. 규칙(연락처 우회 차단)이 놓친 것을 사람이 잡는 마지막 장치다.
 * 같은 사람이 같은 대상을 두 번 신고하지 못한다(신고 도배 방지).
 */
@Entity('offer_reports')
@Unique(['reporterId', 'offerId', 'targetKey'])
export class OfferReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ExpertOffer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offer_id' })
  offer: ExpertOffer;

  @Index()
  @Column({ name: 'offer_id' })
  offerId: string;

  /** 문의를 신고했으면 그 문의 id, 상품 자체면 null */
  @Column({ name: 'message_id', type: 'uuid', nullable: true })
  messageId: string | null;

  /** 중복 신고를 막는 키: 문의 신고면 message id, 상품 신고면 'offer' */
  @Column({ name: 'target_key', length: 40 })
  targetKey: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @Column({ name: 'reporter_id' })
  reporterId: string;

  @Column({ type: 'enum', enum: ReportReason })
  reason: ReportReason;

  @Column({ type: 'varchar', length: 300, nullable: true })
  detail: string | null;

  @Index()
  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.OPEN })
  status: ReportStatus;

  /** 관리자 처리 결과: DISMISS(문제없음) | HIDE_MESSAGE(문의 가림) | CLOSE_OFFER(상품 마감) */
  @Column({ type: 'varchar', length: 20, nullable: true })
  action: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
