import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum PayoutRequestStatus {
  REQUESTED = 'REQUESTED', // 전문가가 출금을 신청함 — 관리자 확인 대기
  PAID = 'PAID', // 관리자가 승인해 (모의) 송금까지 끝남
  REJECTED = 'REJECTED', // 관리자가 반려함 — 금액은 다시 출금 가능 잔액으로 돌아감
}

/**
 * 정산금 출금 신청(모의 송금).
 * - 한 사람은 처리 대기(REQUESTED) 신청을 하나만 가질 수 있다(부분 unique 인덱스) — 동시에 두 번 눌러도 두 건이 되지 않는다.
 * - 보낼 계좌는 신청한 순간의 정산 계좌를 그대로 적어 둔다(은행·끝 4자리·예금주). 신청 뒤 계좌를 바꿔도 이 신청은 처음 계좌로 간다.
 * - 실제 돈은 움직이지 않는다. 승인하면 모의 이체 번호(transferRef)만 남긴다.
 */
@Entity('payout_requests')
@Index('uq_payout_request_open', ['userId'], { unique: true, where: `"status" = 'REQUESTED'` })
export class PayoutRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'bigint' })
  amount: number;

  @Column({ type: 'enum', enum: PayoutRequestStatus, default: PayoutRequestStatus.REQUESTED })
  status: PayoutRequestStatus;

  @Column({ name: 'bank_code', type: 'varchar', length: 3 })
  bankCode: string;

  @Column({ name: 'account_last4', type: 'varchar', length: 4 })
  accountLast4: string;

  @Column({ name: 'holder_name', type: 'varchar', length: 40 })
  holderName: string;

  @Column({ name: 'transfer_ref', type: 'varchar', length: 40, nullable: true })
  transferRef: string | null;

  @Column({ name: 'reject_reason', type: 'varchar', length: 200, nullable: true })
  rejectReason: string | null;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @CreateDateColumn({ name: 'requested_at' })
  requestedAt: Date;
}
