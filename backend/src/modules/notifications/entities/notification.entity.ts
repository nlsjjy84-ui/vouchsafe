import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * =========================================================================
 * Notification — "인앱 알림 로그" (Task #30)
 * =========================================================================
 * 실시간 푸시(웹소켓)가 아니라, 로그인한 사용자가 화면(알림 벨)에서 확인하는
 * "쌓여있는 알림 목록"이다. 지원 선택/결제 확인/결과물 제출/정산/이의제기/
 * 자격 인증 심사 같이, 바운티 진행 중 "상대방이 뭔가 했다"를 사용자가 굳이
 * 새로고침하며 확인하지 않아도 알 수 있게 하는 용도.
 *
 * type은 TypeORM enum이 아니라 varchar로 뒀다 - 알림 종류는 기능이 늘어날 때마다
 * 계속 추가될 가능성이 높은데, enum 컬럼은 값 하나 늘릴 때마다 DB 마이그레이션이
 * 필요해서(이 프로젝트에서 반복적으로 겪은 TypeORM 마찰 중 하나) 이 용도에는 과하다고
 * 판단했다. 타입 안정성은 NotificationsService의 TS 유니온 타입(NotificationType)이
 * 대신 보장한다.
 * =========================================================================
 */
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** 예: "APPLICATION_SELECTED", "PAYMENT_LOCKED" - notifications.service.ts의 NotificationType 참고 */
  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  message: string;

  /** 클릭 시 이동할 바운티 (없을 수도 있음 - 예: 자격 인증 관련 알림) */
  @Column({ name: 'related_bounty_id', type: 'uuid', nullable: true })
  relatedBountyId: string | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
