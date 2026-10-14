import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { MIN_PAYOUT, PayoutRequestService } from './payout-request.service';
import { PayoutRequestStatus } from './entities/payout-request.entity';
import { EscrowStatus } from '../../common/enums/escrow-status.enum';

// 정산금 출금(모의 송금) — 메모리 저장소로 금액 계산·중복 신청·동시 승인을 끝까지 확인한다
function setup() {
  let seq = 0;
  const reqs: any[] = [];
  const txs: any[] = [];
  const accs: any[] = [];
  const ok = (v: any, x: any) => {
    if (v instanceof FindOperator) {
      if (v.type === 'not') return !ok(v.value, x);
      if (v.type === 'in') return (v.value as any[]).includes(x);
    }
    return v === x;
  };
  const match = (where: any) => (r: any) => Object.entries(where).every(([k, v]) => ok(v, r[k]));
  const requests = {
    find: jest.fn(async ({ where }) => reqs.filter(match(where))),
    findOne: jest.fn(async ({ where }) => reqs.find(match(where)) ?? null),
    findOneOrFail: jest.fn(async ({ where }) => {
      const r = reqs.find(match(where));
      if (!r) throw new Error('not found');
      return r;
    }),
    create: jest.fn((v) => ({ ...v })),
    save: jest.fn(async (r) => {
      // 부분 unique 인덱스: 처리 대기(REQUESTED)는 한 사람에 하나
      if (r.status === PayoutRequestStatus.REQUESTED && reqs.some((x) => x !== r && x.userId === r.userId && x.status === PayoutRequestStatus.REQUESTED)) {
        throw new Error('duplicate key uq_payout_request_open');
      }
      if (!r.id) {
        seq += 1;
        r.id = `0000000${seq}-aaaa-bbbb-cccc-dddddddddddd`;
        r.requestedAt = new Date(2026, 9, 14, 10, seq);
      }
      if (!reqs.includes(r)) reqs.push(r);
      return r;
    }),
    update: jest.fn(async (where, patch) => {
      const hit = reqs.filter(match(where));
      hit.forEach((r) => Object.assign(r, patch));
      return { affected: hit.length };
    }),
  };
  const accounts = { findOne: jest.fn(async ({ where }) => accs.find(match(where)) ?? null) };
  const transactions = { find: jest.fn(async ({ where }) => txs.filter(match(where))) };
  const svc = new PayoutRequestService(requests as any, accounts as any, transactions as any);
  const tx = (settled: number, fee: number, status = EscrowStatus.SETTLED, receiverId = 'u1') =>
    txs.push({ receiverId, settledAmount: String(settled), platformFeeAmount: String(fee), escrowStatus: status });
  const account = (userId = 'u1') => accs.push({ userId, bankCode: '004', accountLast4: '1234', holderName: '이도현' });
  return { svc, reqs, tx, account };
}

describe('PayoutRequestService — 정산금 출금(모의 송금)', () => {
  it('출금 가능 금액 = 정산금 − 수수료, 환불된 거래는 빼고 다른 사람 거래도 뺀다', async () => {
    const { svc, tx } = setup();
    tx(100000, 10000);
    tx(50000, 5000);
    tx(80000, 8000, EscrowStatus.REFUNDED);
    tx(70000, 7000, EscrowStatus.SETTLED, 'u2');
    expect(await svc.balance('u1')).toEqual({ earned: 135000, paid: 0, pending: 0, available: 135000, minimum: MIN_PAYOUT });
  });

  it('정산 계좌가 없으면 신청할 수 없다(400)', async () => {
    const { svc, tx } = setup();
    tx(100000, 10000);
    await expect(svc.request('u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('금액을 안 적으면 가능한 금액 전부를 신청하고, 신청한 순간의 계좌를 적어 둔다', async () => {
    const { svc, tx, account } = setup();
    tx(100000, 10000);
    account();
    const v = await svc.request('u1');
    expect(v).toMatchObject({ amount: 90000, status: PayoutRequestStatus.REQUESTED, account: 'KB국민 ****1234', holderName: '이도현' });
    expect(await svc.balance('u1')).toMatchObject({ pending: 90000, available: 0 });
  });

  it('처리 대기 신청이 있으면 두 번째는 막는다(409)', async () => {
    const { svc, tx, account } = setup();
    tx(100000, 10000);
    account();
    await svc.request('u1', 30000);
    await expect(svc.request('u1', 20000)).rejects.toBeInstanceOf(ConflictException);
  });

  it('최소 금액보다 적거나 가능한 금액보다 많으면 막는다', async () => {
    const { svc, tx, account } = setup();
    tx(20000, 2000);
    account();
    await expect(svc.request('u1', MIN_PAYOUT - 1)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.request('u1', 18001)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.request('u1', 18000)).resolves.toMatchObject({ amount: 18000 });
  });

  it('승인하면 모의 이체 번호가 붙고, 두 번째 승인은 막혀 한 번만 보낸다', async () => {
    const { svc, tx, account } = setup();
    tx(100000, 10000);
    account();
    const r = await svc.request('u1', 40000);
    const v = await svc.approve(r.id, 'admin');
    expect(v.status).toBe(PayoutRequestStatus.PAID);
    expect(v.transferRef).toMatch(/^MOCK-\d{8}-[0-9A-F]{8}$/);
    await expect(svc.approve(r.id, 'admin2')).rejects.toBeInstanceOf(ConflictException);
    expect(await svc.balance('u1')).toMatchObject({ paid: 40000, pending: 0, available: 50000 });
  });

  it('동시에 두 관리자가 승인을 눌러도 한 건만 PAID가 된다', async () => {
    const { svc, tx, account } = setup();
    tx(100000, 10000);
    account();
    const r = await svc.request('u1', 40000);
    const out = await Promise.allSettled([svc.approve(r.id, 'a1'), svc.approve(r.id, 'a2')]);
    expect(out.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(await svc.balance('u1')).toMatchObject({ paid: 40000 });
  });

  it('반려하면 사유가 남고 금액은 다시 출금 가능으로 돌아온다', async () => {
    const { svc, tx, account } = setup();
    tx(100000, 10000);
    account();
    const r = await svc.request('u1', 40000);
    const v = await svc.reject(r.id, 'admin', '  예금주 확인 필요  ');
    expect(v).toMatchObject({ status: PayoutRequestStatus.REJECTED, rejectReason: '예금주 확인 필요' });
    expect(await svc.balance('u1')).toMatchObject({ pending: 0, available: 90000 });
    await expect(svc.request('u1', 90000)).resolves.toMatchObject({ amount: 90000 });
  });

  it('없는 신청을 처리하려 하면 404', async () => {
    const { svc } = setup();
    await expect(svc.approve('nope', 'admin')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('대기 목록은 오래된 신청부터, 내 내역은 잔액과 함께', async () => {
    const { svc, tx, account } = setup();
    tx(100000, 10000);
    tx(60000, 6000, EscrowStatus.SETTLED, 'u2');
    account();
    account('u2');
    await svc.request('u1', 20000);
    await svc.request('u2', 30000);
    expect((await svc.pending()).map((x) => x.amount)).toEqual([20000, 30000]);
    const me = await svc.mine('u1');
    expect(me.balance.available).toBe(70000);
    expect(me.requests).toHaveLength(1);
  });
});
