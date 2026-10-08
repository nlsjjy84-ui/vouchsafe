import { Injectable } from '@nestjs/common';
import { AiCompletionRequest, AiCompletionResult, AiProvider } from '../ai.types';

/** OpenAI Responses API 어댑터. 키/모델은 환경변수(OPENAI_API_KEY, AI_MODEL). */
@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY && process.env.AI_MODEL);
  }

  async complete(req: AiCompletionRequest): Promise<AiCompletionResult> {
    const model = process.env.AI_MODEL as string;
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        instructions: req.system,
        input: req.user,
        max_output_tokens: req.maxTokens,
      }),
      signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS ?? 30000)),
    });
    if (!res.ok) {
      throw new Error(`openai http ${res.status}`);
    }
    const body: any = await res.json();
    const text =
      typeof body?.output_text === 'string'
        ? body.output_text
        : (body?.output ?? [])
            .flatMap((o: any) => o?.content ?? [])
            .filter((c: any) => c?.type === 'output_text')
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
