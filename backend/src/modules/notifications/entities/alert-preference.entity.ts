import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * 전문가의 맞춤 알림 설정. 설정을 한 번도 안 바꿨다면 행이 없고, 그때의 기본값은
 * "승인된 인증 분야의 새 프로젝트를 전부 알림"이다(AlertsService.shouldAlert 참고).
 */
@Entity('alert_preferences')
export class AlertPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  userId: string;

  @Column({ default: true })
  enabled: boolean;

  /** 알림 받을 분야. 비어 있으면 인증받은 모든 분야 */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  domains: string[];

  /** 이 금액(원) 이상인 프로젝트만 알림. null이면 제한 없음 */
  @Column({ type: 'int', nullable: true })
  minAmount: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
