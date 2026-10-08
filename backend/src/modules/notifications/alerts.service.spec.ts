import { AlertsService, shouldAlert } from './alerts.service';
import { DomainType } from '../../common/enums/domain-type.enum';
import { NotificationType } from '../../common/enums/notification-type.enum';

describe('shouldAlert', () => {
  const bounty = { domainType: DomainType.VEHICLE_DIAGNOSTICS, bountyAmount: '300000' };
  const verified = [DomainType.VEHICLE_DIAGNOSTICS];

  it('설정이 없으면 인증 분야 프로젝트는 모두 알린다', () => {
    expect(shouldAlert(null, bounty, verified)).toBe(true);
  });
  it('인증받지 않은 분야는 어떤 설정이어도 알리지 않는다', () => {
    expect(shouldAlert(null, bounty, [DomainType.DEV_CODE_REVIEW])).toBe(false);
    expect(shouldAlert({ enabled: true, domains: [], minAmount: null }, bounty, [])).toBe(false);
  });
  it('알림을 끄면 알리지 않는다', () => {
    expect(shouldAlert({ enabled: false, domains: [], minAmount: null }, bounty, verified)).toBe(false);
  });
  it('분야를 골랐으면 그 분야만, 비었으면 인증 분야 전부', () => {
    expect(shouldAlert({ enabled: true, domains: [DomainType.DEV_CODE_REVIEW], minAmount: null }, bounty, verified)).toBe(false);
    expect(shouldAlert({ enabled: true, domains: [DomainType.VEHICLE_DIAGNOSTICS], minAmount: null }, bounty, verified)).toBe(true);
    expect(shouldAlert({ enabled: true, domains: [], minAmount: null }, bounty, verified)).toBe(true);
  });
  it('최소 금액 미만이면 알리지 않고, 같으면 알린다', () => {
    expect(shouldAlert({ enabled: true, domains: [], minAmount: 500000 }, bounty, verified)).toBe(false);
    expect(shouldAlert({ enabled: true, domains: [], minAmount: 300000 }, bounty, verified)).toBe(true);
  });
});

describe('AlertsService.notifyNewBounty', () => {
  const bounty: any = { id: 'b1', clientId: 'client', title: '중고차 동행 검증', bountyAmount: '300000', domainType: DomainType.VEHICLE_DIAGNOSTICS };

  function build(certUserIds: string[], prefs: any[]) {
    const saved: any[] = [];
    const svc = new AlertsService(
      { find: jest.fn().mockResolvedValue(prefs) } as any,
      { find: jest.fn().mockResolvedValue(certUserIds.map((userId) => ({ userId }))) } as any,
      {
        create: jest.fn((x) => x),
        save: jest.fn(async (rows) => {
          saved.push(...rows);
          return rows;
        }),
      } as any,
    );
    return { svc, saved };
  }

  it('설정이 맞는 인증 전문가에게만, 의뢰인 본인은 빼고 보낸다', async () => {
    const { svc, saved } = build(['e1', 'e2', 'e3', 'client'], [
      { userId: 'e2', enabled: false, domains: [], minAmount: null },
      { userId: 'e3', enabled: true, domains: [], minAmount: 900000 },
    ]);
    const n = await svc.notifyNewBounty(bounty);
    expect(n).toBe(1);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ userId: 'e1', type: NotificationType.NEW_BOUNTY_IN_FIELD, relatedBountyId: 'b1' });
    expect(saved[0].message).toContain('중고차 동행 검증');
  });
  it('대상이 없으면 아무것도 저장하지 않는다', async () => {
    const { svc, saved } = build([], []);
    expect(await svc.notifyNewBounty(bounty)).toBe(0);
    expect(saved).toHaveLength(0);
  });
  it('저장이 실패해도 예외를 던지지 않는다', async () => {
    const svc = new AlertsService(
      { find: jest.fn().mockResolvedValue([]) } as any,
      { find: jest.fn().mockRejectedValue(new Error('db down')) } as any,
      {} as any,
    );
    await expect(svc.notifyNewBounty(bounty)).resolves.toBe(0);
  });
});
