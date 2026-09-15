import * as crypto from 'crypto';
import { WebhooksService } from './webhooks.service';

/**
 * 유닛 테스트 — WebhooksService (PortOne 웹훅 HMAC 서명 검증 + 멱등 처리)
 * Standard Webhooks 규격을 그대로 재현해 직접 서명을 만들어보고, 검증 로직이
 * (1) 올바른 서명은 통과, (2) 변조된 payload는 거부, (3) 오래된 timestamp는 거부,
 * (4) 여러 후보 서명 중 하나만 맞아도 통과하는지 확인한다.
 */
describe('WebhooksService', () => {
  const SECRET = 'whsec_' + Buffer.from('test-secret-bytes-0123456789ab').toString('base64');

  function sign(webhookId: string, timestamp: string, rawBody: string, secret = SECRET): string {
    const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const signedContent = `${webhookId}.${timestamp}.${rawBody}`;
    const digest = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');
    return `v1,${digest}`;
  }

  function buildService() {
    const webhookEventRepository = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockResolvedValue(undefined),
    };
    return { service: new WebhooksService(webhookEventRepository as any), webhookEventRepository };
  }

  it('올바르게 서명된 요청은 예외 없이 통과한다', () => {
    const { service } = buildService();
    const webhookId = 'evt_1';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({ amount: 10000 });
    const signatureHeader = sign(webhookId, timestamp, rawBody);

    expect(() =>
      service.verifySignature({
        webhookId,
        timestamp,
        rawBody: Buffer.from(rawBody),
        signatureHeader,
        secret: SECRET,
      }),
    ).not.toThrow();
  });

  it('payload가 한 글자라도 변조되면 서명 검증에 실패한다', () => {
    const { service } = buildService();
    const webhookId = 'evt_2';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const originalBody = JSON.stringify({ amount: 10000 });
    const signatureHeader = sign(webhookId, timestamp, originalBody);
    const tamperedBody = JSON.stringify({ amount: 99999 }); // 서명은 원본 기준인데 body만 바꿔치기

    expect(() =>
      service.verifySignature({
        webhookId,
        timestamp,
        rawBody: Buffer.from(tamperedBody),
        signatureHeader,
        secret: SECRET,
      }),
    ).toThrow('웹훅 서명이 올바르지 않습니다');
  });

  it('허용 범위(5분)를 벗어난 오래된 timestamp는 거부된다 (재생 공격 방지)', () => {
    const { service } = buildService();
    const webhookId = 'evt_3';
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 3600); // 1시간 전
    const rawBody = JSON.stringify({ amount: 5000 });
    const signatureHeader = sign(webhookId, staleTimestamp, rawBody);

    expect(() =>
      service.verifySignature({
        webhookId,
        timestamp: staleTimestamp,
        rawBody: Buffer.from(rawBody),
        signatureHeader,
        secret: SECRET,
      }),
    ).toThrow('webhook-timestamp가 허용 범위를 벗어났습니다');
  });

  it('시크릿 롤오버 상황(여러 서명이 공백으로 이어진 헤더)에서 하나라도 맞으면 통과한다', () => {
    const { service } = buildService();
    const webhookId = 'evt_4';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({ amount: 7000 });
    const wrongSig = 'v1,' + Buffer.from('wrong-signature-bytes').toString('base64');
    const correctSig = sign(webhookId, timestamp, rawBody);
    const combinedHeader = `${wrongSig} ${correctSig}`;

    expect(() =>
      service.verifySignature({
        webhookId,
        timestamp,
        rawBody: Buffer.from(rawBody),
        signatureHeader: combinedHeader,
        secret: SECRET,
      }),
    ).not.toThrow();
  });

  it('recordIfNew는 처음 보는 eventId는 true(새 이벤트)를 반환하고 저장한다', async () => {
    const { service, webhookEventRepository } = buildService();
    webhookEventRepository.findOne.mockResolvedValue(null);
    const isNew = await service.recordIfNew('evt_new', 'portone', 'payment.paid');
    expect(isNew).toBe(true);
    expect(webhookEventRepository.save).toHaveBeenCalled();
  });

  it('recordIfNew는 이미 처리한 eventId(중복 재전송)는 false를 반환하고 저장하지 않는다', async () => {
    const { service, webhookEventRepository } = buildService();
    webhookEventRepository.findOne.mockResolvedValue({ eventId: 'evt_dup' });
    const isNew = await service.recordIfNew('evt_dup', 'portone', 'payment.paid');
    expect(isNew).toBe(false);
    expect(webhookEventRepository.save).not.toHaveBeenCalled();
  });
});
