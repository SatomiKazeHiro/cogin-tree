import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import { AiGenerationErrorKind } from '@skill/shared';
import { AiGeneration } from './entities/ai-generation.entity';

/** AI 调用的业务关联上下文（用于审计行的 user/tree/node 关联） */
export interface AiCallContext {
  userId?: string;
  treeId?: string;
  nodeId?: string;
}

export interface AiGenerationRecord {
  stage: string;
  promptVersion: string;
  prompt: string;
  rawResponse: string;
  parsedOk: boolean;
  latencyMs: number;
  attempt: number;
  errorKind?: AiGenerationErrorKind;
  errorDetail?: string;
  promptTokens?: number;
  completionTokens?: number;
  model?: string;
  ctx: AiCallContext;
}

/**
 * AI 调用审计。
 *
 * 写入失败只记日志、绝不向上抛 —— 审计是旁路，不能因为审计表不可用就让业务调用失败。
 */
@Injectable()
export class AiGenerationService {
  private readonly logger = new Logger(AiGenerationService.name);

  constructor(
    @InjectRepository(AiGeneration)
    private readonly repo: Repository<AiGeneration>,
  ) {}

  async record(entry: AiGenerationRecord): Promise<void> {
    try {
      await this.repo.save(
        this.repo.create({
          stage: entry.stage,
          promptVersion: entry.promptVersion,
          provider: process.env.AI_PROVIDER || 'mock',
          model: entry.model || process.env.AI_MODEL || 'unknown',
          userId: entry.ctx.userId ?? null,
          treeId: entry.ctx.treeId ?? null,
          nodeId: entry.ctx.nodeId ?? null,
          requestHash: createHash('sha1').update(entry.prompt).digest('hex').slice(0, 40),
          rawResponse: entry.rawResponse,
          parsedOk: entry.parsedOk,
          errorKind: entry.errorKind ?? null,
          errorDetail: entry.errorDetail ?? null,
          // 用量两列在实体上是 number | undefined（显式 type 会因 null 联合退化，故不写 | null），
          // 缺省即 undefined → INSERT 时不带该列 → 落 NULL
          promptTokens: entry.promptTokens,
          completionTokens: entry.completionTokens,
          latencyMs: entry.latencyMs,
          attempt: entry.attempt,
        }),
      );
    } catch (err) {
      this.logger.warn(`AI 审计写入失败（已忽略）: ${err}`);
    }
  }
}
