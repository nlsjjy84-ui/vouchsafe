import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { WebhookEvent } from './entities/webhook-event.entity';

const TOLERANCE_SECONDS = 5 * 60; // 5분 — 너무 오래된(재전송/재생 공격 의심) 이벤트는 거부

/**
 * Standard Webhooks(https://www.standardwebhooks.com/) 규격으로 서명 검증 + 멱등 처리.
 *
 * 서명 검증: webhook-id, webhook-timestamp, (raw)body를 "id.timestamp.body" 형태로 이어붙인 뒤
 * 시크릿으로 HMAC-SHA256을 계산해서, webhook-signature 헤더 안의 값들과 타이밍 세이프하게 비교한다.
 * 반드시 "파싱된 JSON을 다시 문자열로 만든 값"이 아니라 "원문 그대로의 바이트(raw body)"로
 * 서명해야 한다 — JSON.stringify가 원문과 한 글자라도 다르게 뱉으면 서명이 안 맞기 때문에,
 * main.ts에서 rawBody: true로 원문을 따로 보존해뒀다.
 *
 * 멱등 처리: webhook-id를 WebhookEvent 테이블의 PK로 저장해두고, 같은 id가 이미 있으면
 * (네트워크 재시도로 같은 이벤트가 여러 번 온 것) 두 번째부터는 조용히 무시한다.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepository: Repository<WebhookEvent>,
  ) {}

  verifySignature(params: {
    webhookId: string;
    timestamp: string;
    rawBody: Buffer;
    signatureHeader: string;
    secret: string;
  }): void {
    const { webhookId, timestamp, rawBody, signatureHeader, secret } = params;

    const timestampSeconds = Number(timestamp);
    if (!Number.isFinite(timestampSeconds)) {
      throw new UnauthorizedException('잘못된 webhook-timestamp입니다');
    }
    const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
    if (ageSeconds > TOLERANCE_SECONDS) {
      throw new UnauthorizedException('webhook-timestamp가 허용 범위를 벗어났습니다');
    }

    const signedContent = `${webhookId}.${timestamp}.${rawBody.toString('utf8')}`;
    // 시크릿은 "whsec_<base64>" 형식을 그대로 지원 (prefix가 없으면 값 전체를 base64로 취급)
    const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest();

    // signature 헤더는 "v1,<base64> v1,<base64> ..." 형태로 여러 개가 공백으로 이어질 수 있다
    // (시크릿 롤오버 기간 동안 신/구 서명을 동시에 보내는 경우) — 하나라도 맞으면 통과.
    const candidates = signatureHeader
      .split(' ')
      .map((part) => part.split(',')[1])
      .filter((v): v is string => Boolean(v));

    const matched = candidates.some((candidate) => {
      let candidateBuf: Buffer;
      try {
        candidateBuf = Buffer.from(candidate, 'base64');
      } catch {
        return false;
      }
      return (
        candidateBuf.length === expected.length && crypto.timingSafeEqual(candidateBuf, expected)
      );
    });

    if (!matched) {
      throw new UnauthorizedException('웹훅 서명이 올바르지 않습니다');
    }
  }

  /** true를 반환하면 "새로 처리해야 하는 이벤트", false면 "이미 처리한 이벤트(무시)" */
  async recordIfNew(eventId: string, source: string, eventType: string): Promise<boolean> {
    const existing = await this.webhookEventRepository.findOne({ where: { eventId } });
    if (existing) {
      this.logger.log(`중복 웹훅 이벤트 무시: ${eventId}`);
      return false;
    }
    await this.webhookEventRepository.save(
      this.webhookEventRepository.create({ eventId, source, eventType }),
    );
    return true;
  }
}
