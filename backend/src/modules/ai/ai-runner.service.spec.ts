import { AiRunnerService } from './ai-runner.service';

function makeRunner(opts: { complete?: jest.Mock; configured?: boolean; dailyCount?: number }) {
  const saved: any[] = [];
  const repo: any = {
    create: (x: any) => x,
    save: async (x: any) => { saved.push(x); return { ...x, id: 'exec-1' }; },
    createQueryBuilder: () => {
      const qb: any = { where: () => qb, andWhere: () => qb, getCount: async () => opts.dailyCount ?? 0 };
      return qb;
    },
  };
  const provider: any = {
    name: 'anthropic',
    isConfigured: () => opts.configured ?? true,
    complete: opts.complete ?? jest.fn(),
  };
  const runner = new AiRunnerService(repo, provider, { name: 'openai', isConfigured: () => false, complete: jest.fn() } as any, { name: 'gemini', isConfigured: () => false, complete: jest.fn() } as any);
  return { runner, saved, provider };
}

const spec = (over: Partial<Parameters<AiRunnerService['run']>[0]> = {}) => ({
  feature: 'REQUIREMENTS_DRAFT' as const,
  bountyId: null,
  requesterId: 'u1',
  instructions: '',
  userPrompt: '',
  maxTokens: 100,
  validate: (j: any) => (j?.ok ? 'AI결과' : null),
  fallback: () => '규칙결과',
  ...over,
}) as any;

describe('AiRunnerService', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });

  it('AI_PROVIDER 미설정이면 규칙 기반 + 이유 기록', async () => {
    delete process.env.AI_PROVIDER;
    const { runner, saved } = makeRunner({});
    const out = await runner.run(spec());
    expect(out.result).toBe('규칙결과');
    expect(out.meta.source).toBe('RULE');
    expect(out.meta.fallbackReason).toBe('AI 제공자 미설정');
    expect(saved[0].source).toBe('RULE');
  });

  it('키/모델이 없으면 호출하지 않는다', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    const { runner, provider } = makeRunner({ configured: false });
    const out = await runner.run(spec());
    expect(out.meta.fallbackReason).toBe('API 키 또는 모델 미설정');
    expect(provider.complete).not.toHaveBeenCalled();
  });

  it('정상 응답이면 AI 결과 + 모델/토큰 기록', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    const complete = jest.fn().mockResolvedValue({ text: '{"ok":true}', provider: 'anthropic', model: 'm1', inputTokens: 10, outputTokens: 5 });
    const { runner, saved } = makeRunner({ complete });
    const out = await runner.run(spec());
    expect(out.result).toBe('AI결과');
    expect(out.meta).toMatchObject({ source: 'AI', provider: 'anthropic', model: 'm1', executionId: 'exec-1' });
    expect(saved[0]).toMatchObject({ inputTokens: 10, outputTokens: 5, source: 'AI' });
  });

  it('출력 검증 실패면 규칙 기반으로 대체', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    const complete = jest.fn().mockResolvedValue({ text: '아무말', provider: 'anthropic', model: 'm1' });
    const { runner } = makeRunner({ complete });
    const out = await runner.run(spec());
    expect(out.result).toBe('규칙결과');
    expect(out.meta.fallbackReason).toBe('모델 출력 검증 실패');
  });

  it('호출이 예외를 던져도 사용자에겐 규칙 결과', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    const complete = jest.fn().mockRejectedValue(new Error('anthropic http 529'));
    const { runner } = makeRunner({ complete });
    const out = await runner.run(spec());
    expect(out.result).toBe('규칙결과');
    expect(out.meta.fallbackReason).toBe('AI 호출 실패');
  });

  it('일일 한도를 넘으면 호출하지 않는다', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.AI_DAILY_LIMIT_PER_USER = '5';
    const { runner, provider } = makeRunner({ dailyCount: 5 });
    const out = await runner.run(spec());
    expect(out.meta.fallbackReason).toBe('일일 사용 한도 초과');
    expect(provider.complete).not.toHaveBeenCalled();
  });
});
