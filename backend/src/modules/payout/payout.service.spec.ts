import { BadRequestException, ConflictException } from '@nestjs/common';
import { PayoutService } from './payout.service';

// 정산 계좌 1인 1계좌 — 메모리 저장소로 실제 규칙을 끝까지 확인한다
function setup() {
  const rows: any[] = [];
  const users = new Map<string, any>([
    ['u1', { id: 'u1', name: '이도현' }],
    ['u2', { id: 'u2', name: '박서윤' }],
  ]);
  const match = (where: any) => (r: any) => Object.entries(where).every(([k, v]) => r[k] === v);
  const accounts = {
    findOne: jest.fn(async ({ where }) => rows.find(match(where)) ?? null),
    create: jest.fn((v) => ({ ...v })),
    save: jest.fn(async (r) => {
      if (rows.some((x) => x !== r && x.accountHash === r.accountHash)) throw new Error('unique account_hash');
      if (!rows.includes(r)) rows.push(r);
      return r;
    }),
  };
  const userRepo = { findOne: jest.fn(async ({ where }) => users.get(where.id) ?? null) };
  return { svc: new PayoutService(accounts as any, userRepo as any), rows };
}

describe('PayoutService — 정산 계좌 1인 1계좌', () => {
  it('본인 명의 계좌를 등록하면 끝 4자리만 보여 주고 원래 번호는 저장하지 않는다', async () => {
    const { svc, rows } = setup();
    const v = await svc.register('u1', { bankCode: '004', accountNumber: '123-456-78901234', holderName: '이도현' });
    expect(v).toMatchObject({ bank: 'KB국민', masked: '****1234', holderName: '이도현' });
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0])).not.toContain('12345678901234');
  });

  it('다시 등록하면 계좌가 바뀔 뿐 두 개가 되지 않는다', async () => {
    const { svc, rows } = setup();
    await svc.register('u1', { bankCode: '004', accountNumber: '12345678901234', holderName: '이도현' });
    const v = await svc.register('u1', { bankCode: '090', accountNumber: '3333-01-2345678', holderName: '이 도현' });
    expect(rows).toHaveLength(1);
    expect(v).toMatchObject({ bank: '카카오뱅크', masked: '****5678' });
    expect(await svc.mine('u1')).toMatchObject({ bankCode: '090' });
  });

  it('다른 회원이 이미 등록한 계좌는 막는다(409)', async () => {
    const { svc } = setup();
    await svc.register('u1', { bankCode: '004', accountNumber: '12345678901234', holderName: '이도현' });
    await expect(svc.register('u2', { bankCode: '004', accountNumber: '1234-5678-901234', holderName: '박서윤' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('같은 번호라도 은행이 다르면 다른 계좌다', async () => {
    const { svc, rows } = setup();
    await svc.register('u1', { bankCode: '004', accountNumber: '12345678901234', holderName: '이도현' });
    await svc.register('u2', { bankCode: '088', accountNumber: '12345678901234', holderName: '박서윤' });
    expect(rows).toHaveLength(2);
  });

  it('예금주가 가입 실명과 다르면 막는다(명의 빌리기 차단)', async () => {
    const { svc } = setup();
    await expect(svc.register('u1', { bankCode: '004', accountNumber: '12345678901234', holderName: '김철수' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('목록에 없는 은행·자릿수가 맞지 않는 번호는 막는다', async () => {
    const { svc } = setup();
    await expect(svc.register('u1', { bankCode: '999', accountNumber: '12345678901234', holderName: '이도현' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.register('u1', { bankCode: '004', accountNumber: '12345', holderName: '이도현' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.register('u1', { bankCode: '004', accountNumber: '1234567890123456', holderName: '이도현' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('등록 전에는 null', async () => {
    const { svc } = setup();
    expect(await svc.mine('u1')).toBeNull();
  });
});
