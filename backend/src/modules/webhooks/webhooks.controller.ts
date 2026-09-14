import { Controller, Headers, HttpCode, Post, Req, RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';

/**
 * 외부 PG(포트원)가 호출하는 엔드포인트라 JWT 인증이 없다 - 대신 서명 검증으로
 * 진위를 확인한다 (WebhooksService 상단 주석 참고). 로그인한 사용자용 API가
 * 아니므로 Swagger 문서에도 "인증 필요" 표시(@ApiBearerAuth)를 달지 않는다.
 */
@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * POST /api/webhooks/portone
   * 포트원 콘솔의 [결제 연동] > [연동 관리] > [결제알림(Webhook) 관리]에 이 주소를
   * 등록해두면, 결제/취소가 발생할 때마다 포트원이 이 엔드포인트를 호출한다.
   *
   * 서명 검증에는 원문 그대로의 body 문자열이 필요해서(JSON.stringify로 재구성한
   * 문자열은 원문과 한 글자라도 다르면 서명이 깨진다), main.ts에서 rawBody: true로
   * 부트스트랩해 req.rawBody(가공 전 Buffer)를 그대로 넘겨받는다.
   */
  @Post('portone')
  @HttpCode(200)
  handlePortOneWebhook(@Req() req: RawBodyRequest<Request>, @Headers() headers: Record<string, string>) {
    return this.webhooksService.handlePortOneWebhook(req.rawBody, headers);
  }
}
