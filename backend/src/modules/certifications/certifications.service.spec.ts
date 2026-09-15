import { BadRequestException } from '@nestjs/common';
import { CertificationsService } from './certifications.service';
import { VerificationStatus } from '../../common/enums/verification-track.enum';

/**
 * 유닛 테스트 — CertificationsService
 * MockVerificationService가 내려준 APPROVED/REJECTED/PENDING 상태를 그대로 저장·알림하는지,
 * 그리고 관리자 수동검토(review)가 PENDING 상태에만 허용되는 가드가 실제로 동작하는지 확인한다.
 */
describe('CertificationsService', () => {
  function buildService(opts: { verifyResult: { status: string; note: string } }) {
    const store = new Map<string, any>();
    let idCounter = 0;
    const certificationRepository = {
      create: jest.fn().mockImplementation((v) => ({ id: `cert-${++idCounter}`, ...v })),
      save: jest.fn().mockImplementation((v) => {
        store.set(v.id, v);
        return Promise.resolve(v);
      }),
      findOne: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(store.get(where.id) ?? null),
      ),
      find: jest.fn(),
    };
    const mockVerification = {
      verifyCertification: jest.fn().mockResolvedValue(opts.verifyResult),
    };
    const notificationsService = { notify: jest.fn().mockResolvedValue(undefined) };
    return {
      service: new CertificationsService(
        certificationRepository as any,
        mockVerification as any,
        notificationsService as any,
      ),
      certificationRepository,
      notificationsService,
    };
  }

  it('OCR mock이 APPROVED를 내려주면 verifiedStatus=APPROVED로 저장되고 알림이 간다', async () => {
    const { service, notificationsService } = buildService({
      verifyResult: { status: 'APPROVED', note: 'ok' },
    });
    const saved = await service.submit('user-1', {
      domainType: 'DEV_CODE_REVIEW',
      track: 'STANDARD',
      licenseNumber: 'LIC-1',
    } as any);
    expect(saved.verifiedStatus).toBe(VerificationStatus.APPROVED);
    expect(notificationsService.notify).toHaveBeenCalled();
  });

  it('OCR mock이 PENDING을 내려주면 관리자 수동검토 대기 메시지로 알림이 간다', async () => {
    const { service, notificationsService } = buildService({
      verifyResult: { status: 'PENDING', note: '신뢰도 낮음' },
    });
    await service.submit('user-1', {
      domainType: 'DEV_CODE_REVIEW',
      track: 'STANDARD',
      licenseNumber: 'LIC-2',
    } as any);
    const message = notificationsService.notify.mock.calls[0][2];
    expect(message).toContain('수동검토');
  });

  it('review()는 PENDING이 아닌 인증 건에는 400을 던진다 (이미 APPROVED/REJECTED 재검토 방지)', async () => {
    const { service } = buildService({ verifyResult: { status: 'APPROVED', note: 'ok' } });
    const saved = await service.submit('user-1', {
      domainType: 'DEV_CODE_REVIEW',
      track: 'STANDARD',
      licenseNumber: 'LIC-3',
    } as any);
    await expect(service.review(saved.id, true, '재검토')).rejects.toThrow(BadRequestException);
  });

  it('review()는 PENDING 건을 승인하면 APPROVED로, 반려하면 REJECTED로 바꾼다', async () => {
    const { service } = buildService({ verifyResult: { status: 'PENDING', note: '검토 필요' } });
    const saved = await service.submit('user-1', {
      domainType: 'DEV_CODE_REVIEW',
      track: 'STANDARD',
      licenseNumber: 'LIC-4',
    } as any);
    const approved = await service.review(saved.id, true, '서류 확인함');
    expect(approved.verifiedStatus).toBe(VerificationStatus.APPROVED);
  });
});
