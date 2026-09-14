import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * =========================================================================
 * AdminAuditLog — "관리자가 뭘, 왜, 언제 했는지"를 영구적으로 남기는 기록
 * =========================================================================
 * 기획 확장판 5장 "관리자 감사 로그(admin_audit_logs): 분쟁 발생 시 관리자가
 * 개입하여 환불이나 강제 정산을 처리할 때, 그 사유와 조치 내역이 운영자 로그에
 * 영구 기록되어 플랫폼의 공정성을 담보한다"에 대응하는 구현.
 *
 * 이 테이블에는 UPDATE/DELETE가 없다 — 오직 INSERT만 한다(append-only).
 * 감사 로그는 "나중에 고칠 수 있는 기록"이면 아무 의미가 없기 때문이다
 * (누가 봐도 "이건 사후에 조작되지 않았다"고 믿을 수 있어야 한다).
 *
 * targetType/targetId를 문자열로 느슨하게 둔 이유: 지금은 이의제기(dispute) 중재
 * 하나에만 쓰이지만, 나중에 "관리자가 사용자를 정지시켰다", "관리자가 인증을
 * 강제로 반려시켰다" 같은 다른 종류의 관리자 조치가 늘어나도 이 테이블 하나로
 * 계속 기록할 수 있게 하기 위함이다.
 */
@Entity('admin_audit_logs')
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'admin_id', type: 'uuid' })
  adminId: string;

  /** 예: "DISPUTE_RESOLVE" */
  @Column()
  action: string;

  /** 예: "dispute" */
  @Column({ name: 'target_type' })
  targetType: string;

  /** 조치 대상의 id (예: dispute.id) */
  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  /** 사람이 읽을 수 있는 조치 사유/내역 (관리자가 입력한 adminNote 등) */
  @Column({ type: 'text' })
  detail: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
