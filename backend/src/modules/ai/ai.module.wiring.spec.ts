import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiRunnerService } from './ai-runner.service';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { ReputationService } from '../users/reputation.service';
import { AiExecution } from './entities/ai-execution.entity';
import { BountyRequirementSet } from './entities/bounty-requirement-set.entity';
import { Bounty } from '../bounties/entities/bounty.entity';
import { BountyApplication } from '../bounties/entities/bounty-application.entity';
import { BountySubmission } from '../bounties/entities/bounty-submission.entity';
import { Certification } from '../certifications/entities/certification.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { User } from '../users/entities/user.entity';

/** 의존성 주입(DI) 배선이 실제로 해석되는지 확인한다. DB 없이 저장소만 가짜로 넣는다. */
describe('AiModule 배선', () => {
  it('컨트롤러/서비스가 의존성을 모두 해석한다', async () => {
    const fakeRepo = { find: jest.fn(), findOne: jest.fn() };
    const mod = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        AiService, AiRunnerService, AnthropicProvider, OpenAiProvider, GeminiProvider,
        { provide: ReputationService, useValue: {} },
        ...[AiExecution, BountyRequirementSet, Bounty, BountyApplication, BountySubmission, Certification, Dispute, User].map(
          (e) => ({ provide: getRepositoryToken(e), useValue: fakeRepo }),
        ),
      ],
    }).compile();
    expect(mod.get(AiController)).toBeDefined();
    expect(mod.get(AiService).status()).toEqual(expect.objectContaining({ mode: 'RULE' }));
  });

  it('상태 화면은 키 값을 절대 노출하지 않는다', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_API_KEY = 'super-secret';
    process.env.AI_MODEL = 'm1';
    const fakeRepo = {};
    const mod = await Test.createTestingModule({
      providers: [
        AiService, AiRunnerService, AnthropicProvider, OpenAiProvider, GeminiProvider,
        { provide: ReputationService, useValue: {} },
        ...[AiExecution, BountyRequirementSet, Bounty, BountyApplication, BountySubmission, Certification, Dispute, User].map(
          (e) => ({ provide: getRepositoryToken(e), useValue: fakeRepo }),
        ),
      ],
    }).compile();
    const s = mod.get(AiService).status();
    expect(JSON.stringify(s)).not.toContain('super-secret');
    expect(s).toEqual({ provider: 'anthropic', configured: true, mode: 'AI', model: 'm1' });
    delete process.env.AI_PROVIDER; delete process.env.ANTHROPIC_API_KEY; delete process.env.AI_MODEL;
  });
});
