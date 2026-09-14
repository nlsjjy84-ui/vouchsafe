import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * =========================================================================
 * PaymentWebhookLog — PG(포트원)가 보내온 웹훅 이벤트를 그대로 남기는 기록
 * =========================================================================
 * AdminAuditLog(관리자가 한 조치)와는 성격이 달라서 별도 테이블로 분리했다 —
 * 이건 "외부(PG)가 우리에게 알려온 사실"의 기록이라 admin_id가 없다.
 *
 * append-only. 나중에 "결제가 왜 승인 처리됐는지/취소 이벤트가 실제로 왔었는지"를
 * 확인해야 할 때(예: 정산 오류 문의 대응) 여기서 원문을 그대로 다시 볼 수 있다.
 * =========================================================================
 */
@Entity('payment_webhook_logs')
export class PaymentWebhookLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 지금은 'portone' 하나뿐이지만, 나중에 다른 PG가 추가될 걸 대비해 필드로 뺐다. */
  @Column({ type: 'varchar', default: 'portone' })
  provider: string;

  /** 포트원이 보내는 이벤트 종류. 예: "Transaction.Paid", "Transaction.Cancelled" */
  @Column({ name: 'event_type', type: 'varchar' })
  eventType: string;

  /** 이 이벤트가 어떤 결제 건에 대한 것인지 (파싱 실패 시 null) */
  @Column({ name: 'payment_id', type: 'varchar', nullable: true })
  paymentId: string | null;

  /** 서명 검증을 통과한 원문 payload 전체 (디버깅/증빙용) */
  @Column({ type: 'text' })
  payload: string;

  @CreateDateColumn({ name: 'received_at' })
  receivedAt: Date;
}
