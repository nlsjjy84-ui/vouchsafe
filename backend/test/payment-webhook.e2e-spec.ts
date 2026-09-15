import * as request from 'supertest';
import * as crypto from 'crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import { createTestApp, randomSuffix } from './utils/test-app';

/**
 * e2e — 결제 웹훅 흐름 (5/5)
 * PortOne 웹훅 수신 → HMAC 서명 검증 → 중복 이벤트 멱등 처리까지의 결제 연동 구간을
 * 실제 서버에 진짜 HTTP 요청을 보내 확인한다 (Standard Webhooks 규격 그대로 서명을 만든다).
 */
describe('결제 웹훅 흐름 (e2e)', () => {
  let app: NestExpressApplication;
  let http: any;

  // test/jest-e2e-env-setup.ts에서 고정한 값과 반드시 동일해야 한다.
  const SECRET = 'whsec_dGVzdC1lMmUtd2ViaG9vay1zZWNyZXQtMzJieXRlcyEh';

  function sign(webhookId: string, timestamp: string, rawBody: string): string {
    const secretBytes = Buffer.from(SECRET.replace(/^whsec_/, ''), 'base64');
    const signedContent = `${webhookId}.${timestamp}.${rawBody}`;
    const digest = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');
    return `v1,${digest}`;
  }

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('올바르게 서명된 웹훅은 200으로 수신되고 duplicate=false로 응답한다', async () => {
    const webhookId = `evt_${randomSuffix()}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({ type: 'Transaction.Paid', paymentId: 'pay_1' });
    const signature = sign(webhookId, timestamp, rawBody);

    const res = await request(http)
      .post('/api/webhooks/portone')
      .set('Content-Type', 'application/json')
      .set('webhook-id', webhookId)
      .set('webhook-timestamp', timestamp)
      .set('webhook-signature', signature)
      .send(rawBody)
      .expect(200);

    expect(res.body).toEqual({ received: true, duplicate: false });
  });

  it('서명이 잘못된(변조되거나 다른 시크릿으로 만든) 웹훅은 401로 거부된다', async () => {
    const webhookId = `evt_${randomSuffix()}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({ type: 'Transaction.Paid', paymentId: 'pay_2' });
    const wrongSignature = 'v1,' + Buffer.from('this-is-not-a-valid-signature').toString('base64');

    await request(http)
      .post('/api/webhooks/portone')
      .set('Content-Type', 'application/json')
      .set('webhook-id', webhookId)
      .set('webhook-timestamp', timestamp)
      .set('webhook-signature', wrongSignature)
      .send(rawBody)
      .expect(401);
  });

  it('같은 webhook-id로 두 번 보내면(네트워크 재시도 시뮬레이션) 두 번째는 duplicate=true로 멱등 처리된다', async () => {
    const webhookId = `evt_${randomSuffix()}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({ type: 'Transaction.Paid', paymentId: 'pay_3' });
    const signature = sign(webhookId, timestamp, rawBody);

    const first = await request(http)
      .post('/api/webhooks/portone')
      .set('Content-Type', 'application/json')
      .set('webhook-id', webhookId)
      .set('webhook-timestamp', timestamp)
      .set('webhook-signature', signature)
      .send(rawBody)
      .expect(200);
    expect(first.body.duplicate).toBe(false);

    const second = await request(http)
      .post('/api/webhooks/portone')
      .set('Content-Type', 'application/json')
      .set('webhook-id', webhookId)
      .set('webhook-timestamp', timestamp)
      .set('webhook-signature', signature)
      .send(rawBody)
      .expect(200);
    expect(second.body.duplicate).toBe(true);
  });

  it('5분보다 오래된 webhook-timestamp는 재생 공격으로 간주되어 401로 거부된다', async () => {
    const webhookId = `evt_${randomSuffix()}`;
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 3600);
    const rawBody = JSON.stringify({ type: 'Transaction.Paid', paymentId: 'pay_4' });
    const signature = sign(webhookId, staleTimestamp, rawBody);

    await request(http)
      .post('/api/webhooks/portone')
      .set('Content-Type', 'application/json')
      .set('webhook-id', webhookId)
      .set('webhook-timestamp', staleTimestamp)
      .set('webhook-signature', signature)
      .send(rawBody)
      .expect(401);
  });
});
