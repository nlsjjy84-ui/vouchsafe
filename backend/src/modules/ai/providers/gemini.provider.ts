import { Injectable } from '@nestjs/common';
import { AiCompletionRequest, AiCompletionResult, AiProvider } from '../ai.types';

/**
 * Google Gemini API(generateContent) 어댑터. 키/모델은 환경변수(GEMINI_API_KEY, AI_MODEL).
 * 키는 URL 쿼리가 아니라 헤더(x-goog-api-key)로 보낸다 — URL은 로그에 남기 쉽기 때문.
 * 주의: 무료 구간에 보낸 내용은 구글 제품 개선에 쓰일 수 있으므로 가짜 데모 데이터로만 쓸 것.
 */
@Injectable()
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY && process.env.AI_MODEL);
  }

  async complete(req: AiCompletionRequest): Promise<AiCompletionResult> {
    const model = (process.env.AI_MODEL as string).replace(/^models\//, '');
    const base = (process.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
    const res = await fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY as string,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [{ text: req.user }] }],
        generationConfig: { maxOutputTokens: req.maxTokens },
      }),
      signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS ?? 30000)),
    });
    if (!res.ok) {
      throw new Error(`gemini http ${res.status}`);
    }
    const body: any = await res.json();
    const text = (body?.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
      .join('');
    return {
      text,
      provider: this.name,
      model,
      inputTokens: body?.usageMetadata?.promptTokenCount,
      outputTokens: body?.usageMetadata?.candidatesTokenCount,
    };
  }
}
