import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OffersService, blockedReason, maskName, median, MAX_ACTIVE_OFFERS } from './offers.service';
import { OfferStatus } from './entities/expert-offer.entity';
import { DomainType } from '../../common/enums/domain-type.enum';
import { ServiceType } from '../../common/enums/service-type.enum';

const DTO = {
  domainType: DomainType.VEHICLE_DIAGNOSTICS,
  title: '중고차 구매 전 동행 점검',
  description: '차가 있는 곳으로 같이 가서 사고·침수 흔적과 하부를 봅니다.',
  price: 120_000,
  serviceType: ServiceType.COMPANION,
  area: '서울',
};

function build(opts: { qualified?: boolean; active?: number; recent?: any; offer?: any; lastHour?: number; same?: any; dupReport?: any } = {}) {
  const offers: any = {
    count: jest.fn().mockResolvedValue(opts.active ?? 0),
    findOne: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id ? ('offer' in opts ? opts.offer : null) : opts.recent ?? null)),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ id: 'o-new', ...x })),
    increment: jest.fn(),
    update: jest.fn(),
  };
  const messages: any = {
    count: jest.fn().mockResolvedValue(opts.lastHour ?? 0),
    findOne: jest.fn().mockResolvedValue(opts.same ?? null),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ id: 'm-new', ...x })),
    createQueryBuilder: jest.fn(() => {
      const qb: any = { select: () => qb, where: () => qb, andWhere: () => qb, limit: () => qb, getRawMany: async () => [{ authorId: 'asker' }] };
      return qb;
    }),
  };
  const bountiesService: any = { createFromOffer: jest.fn().mockResolvedValue({ id: 'b1', status: 'PAYMENT_PENDING' }) };
  const certs: any = { hasApprovedCertification: jest.fn().mockResolvedValue(opts.qualified ?? true) };
  const notifications: any = { notify: jest.fn() };
  const reports: any = {
    findOne: jest.fn().mockResolvedValue((opts as any).dupReport ?? null),
    create: jest.fn((x) => x), save: jest.fn(), update: jest.fn(),
  };
  const svc = new OffersService(offers, messages, {} as any, {} as any, {} as any, reports, bountiesService, certs, notifications);
  return { svc, offers, messages, bountiesService, notifications, reports };
}

const ACTIVE = { id: 'o1', expertId: 'expert', title: '중고차 점검', status: OfferStatus.ACTIVE };

describe('blockedReason', () => {
  it('연락처·직거래·선입금 표현을 막는다', () => {
    expect(blockedReason('카톡 주세요')).toContain('연락처');
    expect(blockedReason('010-1234-5678로 전화 주세요')).toContain('연락처');
    expect(blockedReason('수수료 아끼게 직거래 하시죠')).toContain('플랫폼 밖');
    expect(blockedReason('선입금 부탁드려요')).toContain('선입금');
  });
  it('평범한 문의는 통과한다', () => {
    expect(blockedReason('개인 거래 차도 봐 주시나요?')).toBeNull();
  });
});

describe('median', () => {
  it('비싼 상품 하나에 끌려가지 않는다', () => {
    expect(median([70_000, 120_000, 2_000_000])).toBe(120_000);
    expect(median([100, 200])).toBe(150);
    expect(median([])).toBeNull();
  });
});

describe('OffersService.create', () => {
  it('그 분야 인증이 없으면 올릴 수 없다', async () => {
    const { svc } = build({ qualified: false });
    await expect(svc.create('expert', DTO)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it(`열린 상품이 ${MAX_ACTIVE_OFFERS}개면 더 못 올린다`, async () => {
    const { svc } = build({ active: MAX_ACTIVE_OFFERS });
    await expect(svc.create('expert', DTO)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('10분 안에 연달아 올릴 수 없다', async () => {
    const { svc } = build({ recent: { createdAt: new Date(Date.now() - 60_000) } });
    await expect(svc.create('expert', DTO)).rejects.toThrow('10분');
  });
  it('설명에 연락처가 있으면 막는다', async () => {
    const { svc } = build();
    await expect(svc.create('expert', { ...DTO, description: DTO.description + ' 오픈채팅으로 연락 주세요' })).rejects.toThrow('연락처');
  });
  it('원격 상품은 지역을 저장하지 않는다', async () => {
    const { svc } = build();
    const saved = await svc.create('expert', { ...DTO, serviceType: ServiceType.REMOTE });
    expect(saved.area).toBeNull();
    expect(saved.days).toBe(3);
  });
});

describe('OffersService.addMessage', () => {
  it('없는 상품, 닫힌 상품에는 못 남긴다', async () => {
    await expect(build({ offer: null }).svc.addMessage('u', 'o1', '질문')).rejects.toBeInstanceOf(NotFoundException);
    await expect(build({ offer: { ...ACTIVE, status: OfferStatus.CLOSED } }).svc.addMessage('u', 'o1', '질문')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('한 시간에 20개를 넘기면 막는다', async () => {
    const { svc } = build({ offer: ACTIVE, lastHour: 20 });
    await expect(svc.addMessage('u', 'o1', '질문 있어요')).rejects.toThrow('한 시간');
  });
  it('같은 내용을 반복하면 막는다', async () => {
    const { svc } = build({ offer: ACTIVE, same: { id: 'm0' } });
    await expect(svc.addMessage('u', 'o1', '질문 있어요')).rejects.toThrow('같은 내용');
  });
  it('문의하면 전문가에게, 전문가가 답하면 문의한 사람에게 알린다', async () => {
    const asked = build({ offer: ACTIVE });
    await asked.svc.addMessage('client', 'o1', '주말도 되나요?');
    expect(asked.notifications.notify).toHaveBeenCalledWith('expert', expect.anything(), expect.stringContaining('새 문의'));
    expect(asked.offers.increment).toHaveBeenCalledWith({ id: 'o1' }, 'messageCount', 1);

    const answered = build({ offer: ACTIVE });
    await answered.svc.addMessage('expert', 'o1', '네, 주말도 됩니다.');
    expect(answered.notifications.notify).toHaveBeenCalledWith('asker', expect.anything(), expect.stringContaining('답변'));
  });
});

describe('OffersService.order / close', () => {
  it('열린 상품이면 그 가격으로 프로젝트를 만들고 주문 수를 올린다', async () => {
    const { svc, bountiesService, offers } = build({ offer: ACTIVE });
    await expect(svc.order('client', 'o1', '아반떼 2019년식')).resolves.toEqual({ bountyId: 'b1', status: 'PAYMENT_PENDING' });
    expect(bountiesService.createFromOffer).toHaveBeenCalledWith('client', ACTIVE, '아반떼 2019년식');
    expect(offers.increment).toHaveBeenCalledWith({ id: 'o1' }, 'orderCount', 1);
  });
  it('요청 메모에 연락처를 넣으면 막는다', async () => {
    const { svc, bountiesService } = build({ offer: ACTIVE });
    await expect(svc.order('client', 'o1', '텔레그램으로 연락주세요')).rejects.toThrow('연락처');
    expect(bountiesService.createFromOffer).not.toHaveBeenCalled();
  });
  it('닫힌 상품은 주문할 수 없고, 남의 상품은 닫을 수 없다', async () => {
    await expect(build({ offer: { ...ACTIVE, status: OfferStatus.CLOSED } }).svc.order('client', 'o1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(build({ offer: ACTIVE }).svc.close('someone', 'o1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(build({ offer: { ...ACTIVE } }).svc.close('expert', 'o1')).resolves.toMatchObject({ status: OfferStatus.CLOSED });
  });
});

describe('maskName', () => {
  it('후기 작성자 이름을 가린다', () => {
    expect(maskName('김의뢰')).toBe('김**');
    expect(maskName('이준')).toBe('이*');
    expect(maskName('')).toBe('의뢰인');
  });
});

describe('OffersService 내 상품 관리', () => {
  const MINE = { ...ACTIVE, description: '같이 가서 사고 흔적과 하부를 봅니다.', area: '서울', serviceType: ServiceType.COMPANION, price: 120000, days: 1, images: [] as string[] };

  it('남의 상품은 고칠 수 없다', async () => {
    await expect(build({ offer: MINE }).svc.update('someone', 'o1', { price: 130000 })).rejects.toBeInstanceOf(NotFoundException);
  });
  it('가격·설명을 고치고, 원격으로 바꾸면 지역을 지운다', async () => {
    const saved = await build({ offer: { ...MINE } }).svc.update('expert', 'o1', { price: 110000, serviceType: ServiceType.REMOTE });
    expect(saved).toMatchObject({ price: 110000, serviceType: ServiceType.REMOTE, area: null });
  });
  it('고친 설명에 연락처가 있으면 막는다', async () => {
    await expect(build({ offer: { ...MINE } }).svc.update('expert', 'o1', { description: '자세한 건 오픈채팅으로 물어보세요' })).rejects.toThrow('연락처');
  });
  it('다시 열 때도 열린 상품 5개 제한을 지킨다', async () => {
    const closed = { ...MINE, status: OfferStatus.CLOSED };
    await expect(build({ offer: { ...closed }, active: MAX_ACTIVE_OFFERS }).svc.reopen('expert', 'o1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(build({ offer: { ...closed }, active: 1 }).svc.reopen('expert', 'o1')).resolves.toMatchObject({ status: OfferStatus.ACTIVE });
  });
  it('사진은 상품 하나에 4장까지, 지울 때는 순서 번호로', async () => {
    const full = { ...MINE, images: ['a', 'b', 'c'] };
    await expect(build({ offer: { ...full } }).svc.addImages('expert', 'o1', ['d', 'e'])).rejects.toThrow('4장');
    await expect(build({ offer: { ...full } }).svc.addImages('expert', 'o1', ['d'])).resolves.toMatchObject({ images: ['a', 'b', 'c', 'd'] });
    await expect(build({ offer: { ...full, images: ['a', 'b', 'c'] } }).svc.removeImage('expert', 'o1', 1)).resolves.toMatchObject({ images: ['a', 'c'] });
    await expect(build({ offer: { ...full } }).svc.removeImage('expert', 'o1', 9)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('OffersService 신고', () => {
  it('내 상품은 신고할 수 없고, 같은 대상은 한 번만', async () => {
    await expect(build({ offer: ACTIVE }).svc.report('expert', 'o1', 'OFF_PLATFORM' as any)).rejects.toThrow('내 상품');
    await expect(build({ offer: ACTIVE, dupReport: { id: 'r0' } }).svc.report('client', 'o1', 'OFF_PLATFORM' as any)).rejects.toThrow('이미 신고');
  });
  it('상품 신고는 대상 키를 offer로 저장한다', async () => {
    const { svc, reports } = build({ offer: ACTIVE });
    await svc.report('client', 'o1', 'MISLEADING' as any, ' 자격과 다른 내용 ');
    expect(reports.save).toHaveBeenCalledWith(expect.objectContaining({ targetKey: 'offer', messageId: null, detail: '자격과 다른 내용' }));
  });
  it('처리하면 같은 대상의 열린 신고를 함께 닫고, 상품 마감이면 상품을 닫는다', async () => {
    const { svc, reports, offers } = build();
    reports.findOne.mockResolvedValue({ id: 'r1', offerId: 'o1', targetKey: 'offer', messageId: null });
    await svc.resolveReport('r1', 'CLOSE_OFFER');
    expect(offers.update).toHaveBeenCalledWith({ id: 'o1' }, { status: OfferStatus.CLOSED });
    expect(reports.update).toHaveBeenCalledWith({ offerId: 'o1', targetKey: 'offer', status: 'OPEN' }, { status: 'RESOLVED', action: 'CLOSE_OFFER' });
  });
});
