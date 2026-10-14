import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { PayoutAccount } from './entities/payout-account.entity';
import { User } from '../users/entities/user.entity';
import { RegisterPayoutDto } from './dto/register-payout.dto';

/** 은행 코드(금융결제원 표준 코드 중 자주 쓰는 곳) */
export const BANKS: Record<string, string> = {
  '004': 'KB국민', '088': '신한', '020': '우리', '081': '하나', '011': 'NH농협', '003': 'IBK기업',
  '090': '카카오뱅크', '092': '토스뱅크', '089': '케이뱅크', '023': 'SC제일', '071': '우체국', '045': '새마을금고',
};

export type PayoutView = { bank: string; bankCode: string; masked: string; holderName: string; verifiedAt: Date } | null;

const digitsOf = (s: string) => (s || '').replace(/\D/g, '');
const normName = (s: string) => (s || '').replace(/\s/g, '');

/**
 * 정산 계좌 1인 1계좌.
 * 1) 예금주는 가입한 실명과 같아야 한다(실제 서비스는 오픈뱅킹 예금주 조회 — 지금은 가입 실명과 대조하는 Mock).
 * 2) 한 사람은 계좌를 하나만 둔다. 다시 등록하면 기존 계좌가 새 계좌로 바뀐다(두 개가 되지 않는다).
 * 3) 같은 계좌는 한 사람만 쓸 수 있다. 다른 사람이 이미 등록한 계좌면 막는다.
 */
@Injectable()
export class PayoutService {
  constructor(
    @InjectRepository(PayoutAccount) private readonly accounts: Repository<PayoutAccount>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  static hashOf(bankCode: string, accountNumber: string) {
    return createHash('sha256').update(`${bankCode}:${digitsOf(accountNumber)}`).digest('hex');
  }

  static view(a: PayoutAccount | null): PayoutView {
    if (!a) return null;
    return { bank: BANKS[a.bankCode] || a.bankCode, bankCode: a.bankCode, masked: `****${a.accountLast4}`, holderName: a.holderName, verifiedAt: a.verifiedAt };
  }

  async mine(userId: string): Promise<PayoutView> {
    return PayoutService.view(await this.accounts.findOne({ where: { userId } }));
  }

  async register(userId: string, dto: RegisterPayoutDto): Promise<PayoutView> {
    if (!BANKS[dto.bankCode]) throw new BadRequestException({ errorCode: 'BANK_UNKNOWN', message: '은행을 목록에서 골라 주세요' });
    const digits = digitsOf(dto.accountNumber);
    if (digits.length < 10 || digits.length > 14) {
      throw new BadRequestException({ errorCode: 'ACCOUNT_FORMAT', message: '계좌번호는 숫자 10~14자리로 적어 주세요' });
    }
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다');
    if (normName(dto.holderName) !== normName(user.name)) {
      throw new BadRequestException({ errorCode: 'HOLDER_MISMATCH', message: '예금주가 가입한 이름과 달라요. 본인 명의 계좌만 등록할 수 있어요' });
    }
    const accountHash = PayoutService.hashOf(dto.bankCode, digits);
    const owner = await this.accounts.findOne({ where: { accountHash } });
    if (owner && owner.userId !== userId) {
      throw new ConflictException({ errorCode: 'ACCOUNT_IN_USE', message: '이미 다른 회원이 등록한 계좌예요. 계좌는 한 사람만 쓸 수 있어요' });
    }
    const existing = await this.accounts.findOne({ where: { userId } });
    const row = existing ?? this.accounts.create({ userId });
    row.bankCode = dto.bankCode;
    row.accountHash = accountHash;
    row.accountLast4 = digits.slice(-4);
    row.holderName = user.name;
    row.verifiedAt = new Date();
    return PayoutService.view(await this.accounts.save(row));
  }
}
