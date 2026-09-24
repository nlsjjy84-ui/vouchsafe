import { TransactionsService } from './transactions.service';
import { EscrowStatus } from '../../common/enums/escrow-status.enum';

/**
 * 유닛 테스트 — TransactionsService (에스크로 상태 전이 규칙)
 * 마일스톤 분할 정산의 핵심 규칙: settledAmount가 누적되다가 전체 amount에 도달하는
 * "그 순간" 에만 SETTLED로 전이해야 한다 — 그 전까지는 계속 LOCKED를 유지해야 한다.
 */
describe('TransactionsService', () => {
  function buildService(initialTransaction: any) {
    const saved: any[] = [];
    const transactionRepository = {
      findOne: jest.fn().mockResolvedValue({ ...initialTransaction }),
      save: jest.fn().mockImplementation((v) => {
        saved.push({ ...v });
        return Promise.resolve(v);
      }),
      create: jest.fn().mockImplementation((v) => v),
    };
    const mockEscrow = {
      lock: jest.fn().mockResolvedValue({ reference: 'ref' }),
      settle: jest.fn().mockResolvedValue({ reference: 'ref' }),
      refund: jest.fn().mockResolvedValue({ reference: 'ref' }),
      calculatePlatformFee: jest.fn().mockImplementation((amount: number) => Math.floor(amount * 0.1)),
      calculateClientCancelFee: jest
        .fn()
        .mockImplementation((amount: number) => Math.floor(amount * 0.03)),
    };
    // Task #14: PG 검증은 항상 성공한다고 가정 (검증 실패 케이스는 별도 테스트에서 다룬다)
    const paymentGateway = {
      verifyPayment: jest.fn().mockResolvedValue({ paid: true }),
      cancelPayment: jest.fn().mockResolvedValue({ cancelled: true }),
    };
    return {
      service: new TransactionsService(transactionRepository as any, mockEscrow as any, paymentGateway as any),
      transactionRepository,
      mockEscrow,
      paymentGateway,
      saved,
    };
  }

  it('settleNormally는 금액에서 플랫폼 수수료(10%)를 뗀 뒤 SETTLED로 전이한다', async () => {
    const { service, saved } = buildService({
      bountyId: 'b1',
      amount: 100000,
      settledAmount: 0,
      escrowStatus: EscrowStatus.LOCKED,
    });
    const receiver = { name: '전문가' } as any;
    await service.settleNormally('b1', receiver);
    expect(saved[0].escrowStatus).toBe(EscrowStatus.SETTLED);
    expect(saved[0].platformFeeAmount).toBe(10000);
    expect(saved[0].settledAmount).toBe(100000);
  });

  it('마일스톤 부분 정산 — 아직 전체 금액에 못 미치면 LOCKED를 유지한다', async () => {
    const { service, saved } = buildService({
      bountyId: 'b1',
      amount: 100000,
      settledAmount: 0,
      platformFeeAmount: 0,
      escrowStatus: EscrowStatus.LOCKED,
    });
    const receiver = { name: '전문가' } as any;
    await service.settleMilestonePortion('b1', 40000, receiver);
    expect(saved[0].settledAmount).toBe(40000);
    expect(saved[0].escrowStatus).toBe(EscrowStatus.LOCKED); // 아직 60000원 남음
  });

  it('마일스톤 부분 정산 — 누적 settledAmount가 전체 금액에 도달하는 순간 SETTLED로 전이한다', async () => {
    // 이미 40000원 정산된 상태에서 나머지 60000원을 마저 정산
    const { service, saved } = buildService({
      bountyId: 'b1',
      amount: 100000,
      settledAmount: 40000,
      platformFeeAmount: 4000,
      escrowStatus: EscrowStatus.LOCKED,
    });
    const receiver = { name: '전문가' } as any;
    await service.settleMilestonePortion('b1', 60000, receiver);
    expect(saved[0].settledAmount).toBe(100000);
    expect(saved[0].escrowStatus).toBe(EscrowStatus.SETTLED);
    expect(saved[0].settledAt).toBeInstanceOf(Date);
  });

  it('마일스톤 수수료도 매 부분 정산마다 누적된다', async () => {
    const { service, saved } = buildService({
      bountyId: 'b1',
      amount: 100000,
      settledAmount: 40000,
      platformFeeAmount: 4000, // 첫 마일스톤(40000원)의 10%
      escrowStatus: EscrowStatus.LOCKED,
    });
    const receiver = { name: '전문가' } as any;
    await service.settleMilestonePortion('b1', 60000, receiver); // 이번 마일스톤 수수료 6000원
    expect(saved[0].platformFeeAmount).toBe(10000); // 4000 + 6000 누적
  });

  it('존재하지 않는 프로젝트의 거래를 조회하면 NotFoundException을 던진다', async () => {
    const transactionRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const mockEscrow = { calculatePlatformFee: jest.fn() };
    const paymentGateway = { verifyPayment: jest.fn(), cancelPayment: jest.fn() };
    const service = new TransactionsService(
      transactionRepository as any,
      mockEscrow as any,
      paymentGateway as any,
    );
    await expect(service.settleNormally('nonexistent', { name: 'x' } as any)).rejects.toThrow(
      '해당 프로젝트의 거래 내역을 찾을 수 없습니다',
    );
  });

  it('confirmPayment는 PG 검증에 실패하면 락업하지 않고 예외를 던진다', async () => {
    const { service, saved, mockEscrow } = buildService({
      bountyId: 'b1',
      amount: 100000,
      paymentId: 'bounty-b1-123',
      escrowStatus: EscrowStatus.PENDING_PAYMENT,
    });
    const failingGateway = { verifyPayment: jest.fn().mockResolvedValue({ paid: false, reason: '금액 불일치' }) };
    (service as any).paymentGateway = failingGateway;

    await expect(service.confirmPayment('b1')).rejects.toThrow('금액 불일치');
    expect(mockEscrow.lock).not.toHaveBeenCalled();
    expect(saved.length).toBe(0);
  });

  it('confirmPayment는 PG 검증에 성공하면 에스크로를 잠그고 LOCKED로 전이한다', async () => {
    const { service, saved, mockEscrow } = buildService({
      bountyId: 'b1',
      amount: 100000,
      payerCi: 'ci-hash',
      paymentId: 'bounty-b1-123',
      escrowStatus: EscrowStatus.PENDING_PAYMENT,
    });

    await service.confirmPayment('b1');

    expect(mockEscrow.lock).toHaveBeenCalledWith(100000, 'ci-hash');
    expect(saved[0].escrowStatus).toBe(EscrowStatus.LOCKED);
  });
});
