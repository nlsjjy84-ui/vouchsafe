import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * 수신한 웹훅 이벤트의 멱등 처리용 기록.
 * eventId(발신 측이 보낸 webhook-id 헤더 값)를 PK로 써서, 네트워크 재시도로
 * 같은 이벤트가 여러 번 오더라도 두 번째부터는 조용히 무시하고 200만 돌려준다 —
 * Standard Webhooks 스펙이 "수신자는 반드시 멱등하게 처리해야 한다"고 명시하는 부분.
 */
@Entity('webhook_events')
export class WebhookEvent {
  @PrimaryColumn()
  eventId: string;

  @Column()
  source: string; // 예: 'portone'

  @Column()
  eventType: string;

  @CreateDateColumn()
  receivedAt: Date;
}
