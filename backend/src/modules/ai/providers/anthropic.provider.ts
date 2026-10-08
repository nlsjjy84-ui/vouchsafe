import { Injectable } from '@nestjs/common';
import { AiCompletionRequest, AiCompletionResult, AiProvider } from '../ai.types';

/**
 * Anthropic Messages API 어댑터.
 * 키/모델은 호출 시점에 환경변수에서 읽는다 (ConfigModule이 .env를 읽기 전에 import가 평가되는
 * 문제를 JWT_SECRET에서 겪었던 교훈). 모델 이름은 코드에 박지 않는다 — AI_MODEL 로만 받는다.
 */
@Injectable()
export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY && process.env.AI_MODEL);
  }

  async complete(req: AiCompletionRequest): Promise<AiCompletionResult> {
    const model = process.env.AI_MODEL as string;
    // ANTHROPIC_BASE_URL: 사내 프록시나 테스트용 가짜 서버를 쓸 때만 지정한다(기본은 공식 주소).
    const base = (process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com').replace(/\/+$/, '');
    const res = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY as string,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
      }),
      signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS ?? 30000)),
    });
    if (!res.ok) {
      // 응답 본문에 키가 들어 있을 일은 없지만, 로그/에러에는 상태 코드만 남긴다.
      throw new Error(`anthropic http ${res.status}`);
    }
    const body: any = await res.json();
    const text = (body?.content ?? [])
      .filter((c: any) => c?.type === 'text')
      .map((c: any) => c.text)
      .join('');
    return {
      text,
      provider: this.name,
      model,
      inputTokens: body?.usage?.input_tokens,
      outputTokens: body?.usage?.output_tokens,
    };
  }
}
