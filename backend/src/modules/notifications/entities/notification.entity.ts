import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { NotificationType } from '../../../common/enums/notification-type.enum';

/**
 * 인앱 알림. 기획서 어디에도 "알림 발송에 실패하면 거래를 중단한다"는 요구사항은 없다 —
 * 알림은 어디까지나 부가 기능이라, 이 테이블에 쓰기가 실패하더라도 그걸 호출한 핵심 로직
 * (정산, 이의제기 등)은 절대 실패해서는 안 된다. 그 원칙은 NotificationsService.notify()가
 * 모든 예외를 삼키는 것으로 구현한다 (이 엔티티 자체는 평범한 테이블).
 */
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'uuid', nullable: true })
  relatedBountyId: string | null;

  @Column({ default: false })
  read: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
