import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { PayoutAccount } from './entities/payout-account.entity';
import { PayoutRequest, PayoutRequestStatus } from './entities/payout-request.entity';
import { User } from '../users/entities/user.entity';
import { MIN_PAYOUT, PayoutRequestService } from './payout-request.service';

/**
 * 시연용 출금 기록. 데모 계정은 둘러보기 전용이라 출금을 신청할 수 없으니,
 * 데모 전문가(expert@demo.com)에게만 "보낸 기록 1건 + 처리 대기 1건"을 한 번 만들어 둔다.
 * - 출금 표가 비어 있고, 데모 전문가의 출금 가능 금액이 충분할 때만 만든다(실제 사용자 기록은 건드리지 않는다).
 * - 데모 계좌는 은행 코드 + "demo:사용자 id"의 해시라 실제 계좌와 겹칠 수 없고, 끝 4자리는 0000으로 둔다.
 */
@Injectable()
export class PayoutSeeder implements OnApplicationBootstrap {
  private readonly log = new Logger(PayoutSeeder.name);

  constructor(
    @InjectRepository(PayoutRequest) private readonly requests: Repository<PayoutRequest>,
    @InjectRepository(PayoutAccount) private readonly accounts: Repository<PayoutAccount>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly payouts: PayoutRequestService,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.requests.count()) > 0) return;
      const email = process.env.DEMO_EXPERT_EMAIL ?? 'expert@demo.com';
      const expert = await this.users.findOne({ where: { email } });
      if (!expert) return;
      const { available } = await this.payouts.balance(expert.id);
      if (available < MIN_PAYOUT * 3) return;
      let account = await this.accounts.findOne({ where: { userId: expert.id } });
      if (!account) {
        account = await this.accounts.save(
          this.accounts.create({
            userId: expert.id,
            bankCode: '004',
            accountHash: createHash('sha256').update(`004:demo:${expert.id}`).digest('hex'),
            accountLast4: '0000',
            holderName: expert.name,
            verifiedAt: new Date(),
          }),
        );
      }
      const round = (n: number) => Math.max(MIN_PAYOUT, Math.floor(n / MIN_PAYOUT) * MIN_PAYOUT);
      const snap = { userId: expert.id, bankCode: account.bankCode, accountLast4: account.accountLast4, holderName: account.holderName };
      const paidAt = new Date(Date.now() - 6 * 24 * 3600 * 1000);
      const paid = await this.requests.save(this.requests.create({ ...snap, amount: round(available * 0.4), status: PayoutRequestStatus.REQUESTED }));
      await this.requests.update(paid.id, {
        status: PayoutRequestStatus.PAID,
        transferRef: PayoutRequestService.transferRefOf(paid.id, paidAt),
        requestedAt: new Date(paidAt.getTime() - 24 * 3600 * 1000),
        decidedAt: paidAt,
      });
      await this.requests.save(this.requests.create({ ...snap, amount: round(available * 0.2), status: PayoutRequestStatus.REQUESTED }));
      this.log.log('시연용 출금 기록 2건을 만들었습니다');
    } catch (e) {
      this.log.warn(`시연용 출금 기록을 만들지 못했습니다: ${(e as Error).message}`);
    }
  }
}
