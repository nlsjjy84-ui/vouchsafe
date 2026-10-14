import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * 정산 계좌 — 1인 1계좌.
 * - userId unique: 한 사람(= CI로 1인 1계정)이 계좌를 하나만 가진다. 바꾸면 그 한 줄이 새 계좌로 바뀐다.
 * - accountHash unique: 같은 계좌를 다른 사람이 등록할 수 없다(통장 돌려쓰기·명의 빌리기 차단).
 * 계좌번호 원문은 저장하지 않는다. 은행 코드 + 번호의 해시와 끝 4자리만 남긴다.
 */
@Entity('payout_accounts')
export class PayoutAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ name: 'bank_code', type: 'varchar', length: 3 })
  bankCode: string;

  @Column({ name: 'account_hash', type: 'varchar', length: 64, unique: true })
  accountHash: string;

  @Column({ name: 'account_last4', type: 'varchar', length: 4 })
  accountLast4: string;

  @Column({ name: 'holder_name', type: 'varchar', length: 40 })
  holderName: string;

  @Column({ name: 'verified_at', type: 'timestamptz' })
  verifiedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
