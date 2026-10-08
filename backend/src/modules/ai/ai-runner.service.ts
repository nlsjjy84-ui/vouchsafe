import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiExecution } from './entities/ai-execution.entity';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import {
  ADVISORY_NOTICE,
  AiFeature,
  AiMeta,
  AiProvider,
  AiSource,
} from './ai.types';
import { SYSTEM_PREAMBLE, extractJson } from './ai-guards';

export interface RunSpec<T> {
  feature: AiFeature;
  bountyId: string | null;
  requesterId: string;
  /** 기능별 지시문 (SYSTEM_PREAMBLE 뒤에 붙는다) */
  instructions: string;
  /** 이미 <user_data>로 감싼 입력 */
  userPrompt: string;
  maxTokens: number;
  /**
   * 모델이 돌려준 JSON을 검증한다. 형식/근거가 맞으면 정제된 결과를, 아니면 null을 돌려준다.
   * (null이면 규칙 기반 결과로 대체된다)
   */
  validate: (json: unknown) => T | null;
  /** 규칙 기반 대체 결과. 키가 없어도, 호출이 실패해도 항상 동작해야 한다. */
  fallback: () => T;
}

export interface RunOutput<T> {
  result: T;
  meta: AiMeta;
}

/**
 * AI 호출의 단일 관문. 모든 AI 기능은 이 서비스만 통해 모델을 부른다.
 *  - 제공자 선택: 환경변수 AI_PROVIDER = anthropic | openai | gemini | none (기본 none)
 *  - 일일 한도: 사용자당 AI_DAILY_LIMIT_PER_USER (기본 30)회를 넘으면 규칙 기반으로 처리
 *  - 실패(키 없음/네트워크/타임아웃/잘못된 출력)는 예외를 올리지 않고 규칙 기반 결과로 대체
 *  - 매 실행을 AiExecution에 기록 (출처, 모델, 토큰, 지연시간, 결과)
 */
@Injectable()
export class AiRunnerService {
  private readonly logger = new Logger(AiRunnerService.name);

  constructor(
    @InjectRepository(AiExecution)
    private readonly executionRepo: Repository<AiExecution>,
    private readonly anthropic: AnthropicProvider,
    private readonly openai: OpenAiProvider,
    private readonly gemini: GeminiProvider,
  ) {}

  selectedProvider(): AiProvider | null {
    const name = (process.env.AI_PROVIDER ?? 'none').toLowerCase();
    if (name === 'anthropic') return this.anthropic;
    if (name === 'openai') return this.openai;
    if (name === 'gemini') return this.gemini;
    return null;
  }

  async run<T>(spec: RunSpec<T>): Promise<RunOutput<T>> {
    const started = Date.now();
    let source: AiSource = 'RULE';
    let result: T | null = null;
    let provider: string | null = null;
    let model: string | null = null;
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    let fallbackReason: string | null = null;

    const selected = this.selectedProvider();
    if (!selected) {
      fallbackReason = 'AI 제공자 미설정';
    } else if (!selected.isConfigured()) {
      fallbackReason = 'API 키 또는 모델 미설정';
    } else if (await this.overDailyLimit(spec.requesterId)) {
      fallbackReason = '일일 사용 한도 초과';
    } else {
      try {
        const out = await selected.complete({
          system: `${SYSTEM_PREAMBLE}\n${spec.instructions}`,
          user: spec.userPrompt,
          maxTokens: spec.maxTokens,
        });
        provider = out.provider;
        model = out.model;
        inputTokens = out.inputTokens ?? null;
        outputTokens = out.outputTokens ?? null;
        const validated = spec.validate(extractJson(out.text));
        if (validated) {
          result = validated;
          source = 'AI';
        } else {
          fallbackReason = '모델 출력 검증 실패';
          // 진단용: 거부된 출력의 앞부분만 남긴다(키·요청 본문은 남기지 않는다).
          this.logger.warn(`AI 출력 검증 실패(${spec.feature}): ${(out.text ?? '').replace(/\s+/g, ' ').slice(0, 400)}`);
        }
      } catch (err) {
        // 키나 요청 본문이 로그에 남지 않도록 메시지(상태 코드 정도)만 기록한다.
        this.logger.warn(`AI 호출 실패(${spec.feature}): ${(err as Error).message}`);
        fallbackReason = 'AI 호출 실패';
      }
    }

    if (!result) result = spec.fallback();

    let executionId: string | null = null;
    try {
      const saved = await this.executionRepo.save(
        this.executionRepo.create({
          feature: spec.feature,
          bountyId: spec.bountyId,
          requesterId: spec.requesterId,
          source,
          provider,
          model,
          fallbackReason: source === 'RULE' ? fallbackReason : null,
          inputTokens,
          outputTokens,
          latencyMs: Date.now() - started,
          result: result as unknown,
        }),
      );
      executionId = saved.id;
    } catch (err) {
      // 기록 실패가 사용자 응답을 막지 않게 한다.
      this.logger.error(`AI 실행 기록 저장 실패: ${(err as Error).message}`);
    }

    return {
      result,
      meta: {
        source,
        provider,
        model,
        executionId,
        fallbackReason: source === 'RULE' ? fallbackReason : null,
        advisoryNotice: ADVISORY_NOTICE,
      },
    };
  }

  private async overDailyLimit(requesterId: string): Promise<boolean> {
    const limit = Number(process.env.AI_DAILY_LIMIT_PER_USER ?? 30);
    if (!Number.isFinite(limit) || limit <= 0) return true;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const count = await this.executionRepo
      .createQueryBuilder('e')
      .where('e.requesterId = :id', { id: requesterId })
      .andWhere("e.source = 'AI'")
      .andWhere('e.createdAt >= :since', { since })
      .getCount();
    return count >= limit;
  }

  async history(bountyId: string, take = 30) {
    return this.executionRepo.find({
      where: { bountyId },
      order: { createdAt: 'DESC' },
      take,
      select: ['id', 'feature', 'source', 'provider', 'model', 'fallbackReason', 'latencyMs', 'createdAt'],
    });
  }
}
