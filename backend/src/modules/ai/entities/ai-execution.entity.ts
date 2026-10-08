import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * AI 실행 기록(출처 추적). "이 결과가 AI에서 왔는지 규칙에서 왔는지, 어떤 입력으로 언제 나왔는지"를
 * 남겨서 분쟁·감사 때 AI 결과가 근거로 쓰였는지 확인할 수 있게 한다.
 * 원문 입력(공고/메시지 전문)은 저장하지 않고 결과만 저장한다 — 개인정보 최소 보관.
 * TypeORM 교훈: union 타입/nullable 컬럼은 type을 명시한다.
 */
@Entity('ai_executions')
@Index(['requesterId', 'createdAt'])
export class AiExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 40 })
  feature: string;

  @Column({ name: 'bounty_id', type: 'uuid', nullable: true })
  bountyId: string | null;

  @Column({ name: 'requester_id', type: 'uuid' })
  requesterId: string;

  @Column({ type: 'varchar', length: 8 })
  source: string; // 'AI' | 'RULE'

  @Column({ type: 'varchar', length: 20, nullable: true })
  provider: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string | null;

  @Column({ name: 'fallback_reason', type: 'varchar', length: 80, nullable: true })
  fallbackReason: string | null;

  @Column({ name: 'input_tokens', type: 'int', nullable: true })
  inputTokens: number | null;

  @Column({ name: 'output_tokens', type: 'int', nullable: true })
  outputTokens: number | null;

  @Column({ name: 'latency_ms', type: 'int', default: 0 })
  latencyMs: number;

  @Column({ type: 'jsonb', nullable: true })
  result: unknown;

  @CreateDateColumn()
  createdAt: Date;
}
