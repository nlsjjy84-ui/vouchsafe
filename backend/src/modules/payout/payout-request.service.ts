import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { PayoutAccount } from './entities/payout-account.entity';
import { PayoutRequest, PayoutRequestStatus } from './entities/payout-request.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { EscrowStatus } from '../../common/enums/escrow-status.enum';
import { BANKS } from './payout.service';

/** 한 번에 신청할 수 있는 최소 금액(가정값: 이체 수수료보다 작은 출금은 받지 않는다) */
export const MIN_PAYOUT = 10000;

export type PayoutBalance = { earned: number; paid: number; pending: number; available: number; minimum: number };

/**
 * 정산금 출금(모의 송금) — 정산 계좌 1인 1계좌 다음 단계.
 * 흐름: 정산 완료된 금액(수수료 뺀 몫) → 전문가가 출금 신청 → 관리자가 승인(모의 이체) 또는 반려.
 *
 * - 출금 가능 = 정산받은 금액(수수료 제외) − 이미 보낸 금액 − 처리 대기 중인 금액. 환불된 거래는 넣지 않는다.
 * - 정산 계좌가 없으면 신청할 수 없다. 신청한 순간의 계좌(은행·끝 4자리·예금주)를 그대로 적어 둔다.
 * - 처리 대기 신청은 한 사람에 하나만(DB 부분 unique 인덱스가 두 번째 안전장치).
 * - 승인은 "REQUESTED인 것만 PAID로" 한 번에 바꾸는 조건부 업데이트라, 두 관리자가 동시에 눌러도 한 번만 송금된다.
 */
@Injectable()
export class PayoutRequestService {
  constructor(
    @InjectRepository(PayoutRequest) private readonly requests: Repository<PayoutRequest>,
    @InjectRepository(PayoutAccount) private readonly accounts: Repository<PayoutAccount>,
    @InjectRepository(Transaction) private readonly transactions: Repository<Transaction>,
  ) {}

  async balance(userId: string): Promise<PayoutBalance> {
    const txs = await this.transactions.find({ where: { receiverId: userId, escrowStatus: Not(EscrowStatus.REFUNDED) } });
    const earned = txs.reduce((s, t) => s + Math.max(0, Number(t.settledAmount) - Number(t.platformFeeAmount)), 0);
    const rows = await this.requests.find({ where: { userId, status: In([PayoutRequestStatus.PAID, PayoutRequestStatus.REQUESTED]) } });
    const paid = rows.filter((r) => r.status === PayoutRequestStatus.PAID).reduce((s, r) => s + Number(r.amount), 0);
    const pending = rows.filter((r) => r.status === PayoutRequestStatus.REQUESTED).reduce((s, r) => s + Number(r.amount), 0);
    return { earned, paid, pending, available: Math.max(0, earned - paid - pending), minimum: MIN_PAYOUT };
  }

  static view(r: PayoutRequest) {
    return {
      id: r.id,
      amount: Number(r.amount),
      status: r.status,
      account: `${BANKS[r.bankCode] || r.bankCode} ****${r.accountLast4}`,
      holderName: r.holderName,
      transferRef: r.transferRef,
      rejectReason: r.rejectReason,
      requestedAt: r.requestedAt,
      decidedAt: r.decidedAt,
    };
  }

  async mine(userId: string) {
    const list = await this.requests.find({ where: { userId }, order: { requestedAt: 'DESC' }, take: 20 });
    return { balance: await this.balance(userId), requests: list.map(PayoutRequestService.view) };
  }

  async request(userId: string, amount?: number) {
    const account = await this.accounts.findOne({ where: { userId } });
    if (!account) throw new BadRequestException({ errorCode: 'NO_PAYOUT_ACCOUNT', message: '정산 계좌를 먼저 등록해 주세요' });
    const open = await this.requests.findOne({ where: { userId, status: PayoutRequestStatus.REQUESTED } });
    if (open) throw new ConflictException({ errorCode: 'PAYOUT_PENDING', message: '처리 중인 출금 신청이 있어요. 끝난 뒤에 다시 신청해 주세요' });
    const { available } = await this.balance(userId);
    const want = amount ?? available;
    if (want < MIN_PAYOUT) {
      throw new BadRequestException({ errorCode: 'PAYOUT_TOO_SMALL', message: `${MIN_PAYOUT.toLocaleString('ko-KR')}원부터 출금할 수 있어요` });
    }
    if (want > available) {
      throw new BadRequestException({ errorCode: 'PAYOUT_OVER_BALANCE', message: `출금 가능 금액(${available.toLocaleString('ko-KR')}원)보다 많아요` });
    }
    try {
      const saved = await this.requests.save(
        this.requests.create({
          userId,
          amount: want,
          status: PayoutRequestStatus.REQUESTED,
          bankCode: account.bankCode,
          accountLast4: account.accountLast4,
          holderName: account.holderName,
        }),
      );
      return PayoutRequestService.view(saved);
    } catch (e) {
      // 같은 순간 두 번 눌러 부분 unique 인덱스에 걸린 경우
      throw new ConflictException({ errorCode: 'PAYOUT_PENDING', message: '처리 중인 출금 신청이 있어요' });
    }
  }

  async pending() {
    const list = await this.requests.find({ where: { status: PayoutRequestStatus.REQUESTED }, order: { requestedAt: 'ASC' } });
    return list.map(PayoutRequestService.view);
  }

  /** 모의 이체 번호: 실제 서비스에서는 펌뱅킹·오픈뱅킹 출금이체의 거래 고유번호가 들어갈 자리 */
  static transferRefOf(id: string, at: Date) {
    const d = at.toISOString().slice(0, 10).replace(/-/g, '');
    return `MOCK-${d}-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }

  async approve(id: string, adminId: string) {
    const now = new Date();
    const ref = PayoutRequestService.transferRefOf(id, now);
    const res = await this.requests.update(
      { id, status: PayoutRequestStatus.REQUESTED },
      { status: PayoutRequestStatus.PAID, transferRef: ref, decidedBy: adminId, decidedAt: now },
    );
    if (!res.affected) await this.notOpen(id);
    return PayoutRequestService.view(await this.requests.findOneOrFail({ where: { id } }));
  }

  async reject(id: string, adminId: string, reason: string) {
    const res = await this.requests.update(
      { id, status: PayoutRequestStatus.REQUESTED },
      { status: PayoutRequestStatus.REJECTED, rejectReason: reason.trim(), decidedBy: adminId, decidedAt: new Date() },
    );
    if (!res.affected) await this.notOpen(id);
    return PayoutRequestService.view(await this.requests.findOneOrFail({ where: { id } }));
  }

  private async notOpen(id: string): Promise<never> {
    const row = await this.requests.findOne({ where: { id } });
    if (!row) throw new NotFoundException('출금 신청을 찾을 수 없습니다');
    throw new ConflictException({ errorCode: 'PAYOUT_ALREADY_DECIDED', message: '이미 처리된 출금 신청이에요' });
  }
}
