import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';
import { Throttle } from '@nestjs/throttler';

/**
 * PortOne 등 외부 서비스가 보내는 웹훅 수신 엔드포인트.
 * 로그인 토큰이 아니라 HMAC 서명으로 인증하기 때문에 JwtAuthGuard를 붙이지 않는다 —
 * 대신 WebhooksService.verifySignature가 그 역할을 대신한다.
 */
@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * POST /api/webhooks/portone
   * 헤더: webhook-id, webhook-timestamp, webhook-signature (Standard Webhooks 규격)
   */
  @Throttle({ default: { limit: 100, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('portone')
  async handlePortOneWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('webhook-id') webhookId: string,
    @Headers('webhook-timestamp') timestamp: string,
    @Headers('webhook-signature') signature: string,
    @Body() body: { type?: string },
  ) {
    const secret = process.env.PORTONE_WEBHOOK_SECRET ?? '';
    // rawBody는 main.ts의 NestFactory.create(AppModule, { rawBody: true }) 설정으로 채워진다 —
    // JSON.parse(JSON.stringify(body))는 원문과 바이트 단위로 다를 수 있어 서명 검증에 쓸 수 없다.
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(body ?? {}));

    this.webhooksService.verifySignature({
      webhookId,
      timestamp,
      rawBody,
      signatureHeader: signature,
      secret,
    });

    const eventType = body?.type ?? 'unknown';
    const isNew = await this.webhooksService.recordIfNew(webhookId, 'portone', eventType);
    if (!isNew) {
      return { received: true, duplicate: true };
    }

    // 실제로는 여기서 eventType에 따라 결제 상태 갱신 등의 후속 처리를 분기한다.
    // (예: 'Transaction.Paid' → 해당 프로젝트/결제 레코드 상태 갱신)
    return { received: true, duplicate: false };
  }
}
