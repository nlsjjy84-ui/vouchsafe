import { ForbiddenException } from '@nestjs/common';
import { BountiesService } from './bounties.service';
import { DomainType } from '../../common/enums/domain-type.enum';
import { ServiceType } from '../../common/enums/service-type.enum';

/** 전문가 상품으로 의뢰하기 — 상품 가격·전문가 그대로 프로젝트를 만들고 기존 선택·결제 흐름을 탄다. */
describe('BountiesService.createFromOffer', () => {
  const offer = {
    id: 'o1', expertId: 'expert', domainType: DomainType.VEHICLE_DIAGNOSTICS, title: '중고차 동행 점검',
    description: '같이 가서 봅니다.', price: 120000, serviceType: ServiceType.COMPANION, area: '서울·경기',
  };

  function build(qualified = true) {
    const svc = Object.create(BountiesService.prototype) as any;
    svc.certificationsService = { hasApprovedCertification: jest.fn().mockResolvedValue(qualified) };
    svc.bountyRepository = { create: jest.fn((x) => x), save: jest.fn(async (x) => ({ id: 'b1', ...x })) };
    svc.applicationRepository = { create: jest.fn((x) => x), save: jest.fn(async (x) => ({ id: 'a1', ...x })) };
    svc.alertsService = { notifyNewBounty: jest.fn() };
    svc.selectApplicant = jest.fn().mockResolvedValue({ id: 'b1', status: 'PAYMENT_PENDING' });
    return svc;
  }

  it('내 상품은 의뢰할 수 없다', async () => {
    await expect(build().createFromOffer('expert', offer)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('전문가 인증이 끊겼으면 의뢰할 수 없다', async () => {
    await expect(build(false).createFromOffer('client', offer)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('상품 가격·분야·동행 장소로 프로젝트를 만들고 그 전문가를 바로 선택한다', async () => {
    const svc = build();
    const result = await svc.createFromOffer('client', offer, '아반떼 2019년식');
    const saved = svc.bountyRepository.save.mock.calls[0][0];
    expect(saved).toMatchObject({ clientId: 'client', bountyAmount: 120000, domainType: DomainType.VEHICLE_DIAGNOSTICS, companionLocation: '서울·경기' });
    expect(saved.description).toContain('아반떼 2019년식');
    expect(svc.applicationRepository.save.mock.calls[0][0]).toMatchObject({ bountyId: 'b1', expertId: 'expert' });
    expect(svc.selectApplicant).toHaveBeenCalledWith('b1', 'a1', 'client');
    expect(svc.alertsService.notifyNewBounty).not.toHaveBeenCalled();
    expect(result.status).toBe('PAYMENT_PENDING');
  });
});
