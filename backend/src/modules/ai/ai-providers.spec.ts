import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';

describe('provider 어댑터 (fetch 모킹)', () => {
  const env = { ...process.env };
  const realFetch = global.fetch;
  afterEach(() => { process.env = { ...env }; global.fetch = realFetch; });

  it('Anthropic: 키/모델이 있어야 configured, 요청 형식과 응답 파싱', async () => {
    const p = new AnthropicProvider();
    delete process.env.ANTHROPIC_API_KEY; delete process.env.AI_MODEL;
    expect(p.isConfigured()).toBe(false);
    process.env.ANTHROPIC_API_KEY = 'test-key'; process.env.AI_MODEL = 'test-model';
    expect(p.isConfigured()).toBe(true);

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"a":1}' }], usage: { input_tokens: 7, output_tokens: 3 } }),
    });
    global.fetch = fetchMock as any;
    const out = await p.complete({ system: 'S', user: 'U', maxTokens: 50 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('test-key');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
    expect(JSON.parse(init.body)).toMatchObject({ model: 'test-model', max_tokens: 50, system: 'S', messages: [{ role: 'user', content: 'U' }] });
    expect(out).toMatchObject({ text: '{"a":1}', inputTokens: 7, outputTokens: 3, model: 'test-model' });
  });

  it('HTTP 오류는 상태 코드만 담은 예외 (키가 메시지에 없다)', async () => {
    process.env.ANTHROPIC_API_KEY = 'secret-key'; process.env.AI_MODEL = 'm';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }) as any;
    await expect(new AnthropicProvider().complete({ system: '', user: '', maxTokens: 1 })).rejects.toThrow('anthropic http 401');
    await expect(new AnthropicProvider().complete({ system: '', user: '', maxTokens: 1 })).rejects.not.toThrow(/secret-key/);
  });

  it('OpenAI: Responses API 형식', async () => {
    process.env.OPENAI_API_KEY = 'k'; process.env.AI_MODEL = 'm';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: '{"b":2}', usage: { input_tokens: 4, output_tokens: 2 } }),
    });
    global.fetch = fetchMock as any;
    const out = await new OpenAiProvider().complete({ system: 'S', user: 'U', maxTokens: 20 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(init.headers.authorization).toBe('Bearer k');
    expect(JSON.parse(init.body)).toMatchObject({ model: 'm', instructions: 'S', input: 'U', max_output_tokens: 20 });
    expect(out.text).toBe('{"b":2}');
  });

  it('Gemini: 키는 헤더로, 모델은 경로로, 응답 파싱', async () => {
    const p = new GeminiProvider();
    delete process.env.GEMINI_API_KEY; delete process.env.AI_MODEL;
    expect(p.isConfigured()).toBe(false);
    process.env.GEMINI_API_KEY = 'g-key'; process.env.AI_MODEL = 'models/some-flash';
    expect(p.isConfigured()).toBe(true);
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"c":' }, { text: '3}' }] } }], usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 4 } }),
    });
    global.fetch = fetchMock as any;
    const out = await p.complete({ system: 'S', user: 'U', maxTokens: 30 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/some-flash:generateContent');
    expect(url).not.toContain('g-key'); // 키가 URL에 들어가면 안 된다
    expect(init.headers['x-goog-api-key']).toBe('g-key');
    expect(JSON.parse(init.body)).toMatchObject({ systemInstruction: { parts: [{ text: 'S' }] }, contents: [{ role: 'user', parts: [{ text: 'U' }] }], generationConfig: { maxOutputTokens: 30 } });
    expect(out).toMatchObject({ text: '{"c":3}', inputTokens: 9, outputTokens: 4, model: 'some-flash' });
  });
});
