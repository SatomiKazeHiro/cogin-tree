import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProviderFactory, IAIProvider, AIProviderResult } from '@skill/ai-provider';
import {
  AiContractError,
  PromptManager,
  PromptStage,
  StageInput,
  StageOutput,
} from '@skill/prompt-manager';
import { AIProviderConfig, AIProviderType, AiGenerationErrorKind, TreeType } from '@skill/shared';
import { AiCallContext, AiGenerationService } from './ai-generation.service';

const MAX_ATTEMPTS = 2;

/** stage 4（discover-new）与 stage 5（check-expire）共用的入参形状 */
export interface DiscoveryNodeInput {
  treeName: string;
  treeType?: string;
  nodes: { level: number; title: string; description?: string; parentTitle?: string }[];
  existingSuggestions?: string[];
}

@Injectable()
export class AiIntegrationService {
  constructor(
    private readonly configService: ConfigService,
    private readonly audit: AiGenerationService,
  ) {}

  async getProvider(): Promise<IAIProvider> {
    const providerConfig: AIProviderConfig = {
      provider:
        (this.configService.get<string>('AI_PROVIDER') as AIProviderType) ||
        AIProviderType.MOCK,
      apiKey: this.configService.get<string>('AI_API_KEY') || '',
      model: this.configService.get<string>('AI_MODEL') || 'deepseek-chat',
      baseUrl: this.configService.get<string>('AI_BASE_URL'),
    };
    return AIProviderFactory.create(providerConfig.provider, providerConfig);
  }

  private l3MaxTokens(): number {
    const raw = this.configService.get<string>('AI_L3_MAX_TOKENS');
    return raw ? parseInt(raw, 10) || 4096 : 4096;
  }

  /**
   * 唯一的 AI 调用入口：调用 → 审计 → 契约校验 → 失败带反馈重试一次。
   *
   * - 契约不通过时绝不返回半成品：要么返回校验通过的完整结果，要么抛 AiContractError
   * - provider 自身报错（网络/超时）不重试，直接向上抛（重试无意义且会放大故障）
   * - 每次调用（含重试）各落一条 ai_generations 审计，审计失败不影响主流程
   */
  async generate<K extends PromptStage>(
    stage: K,
    input: StageInput<K>,
    ctx: AiCallContext,
    options?: { maxTokens?: number },
  ): Promise<StageOutput<K>> {
    const provider = await this.getProvider();
    const basePrompt = PromptManager.build(stage, input);
    const promptVersion = PromptManager.versionOf(stage);

    let prompt = basePrompt;
    let lastError: AiContractError | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const startedAt = Date.now();

      let result: AIProviderResult;
      try {
        result = await provider.chat(prompt, {
          maxTokens: options?.maxTokens,
          // 重试时降低温度，让它更保守地照着契约输出
          temperature: attempt === 1 ? 0.7 : 0.3,
        });
      } catch (err) {
        await this.audit.record({
          stage,
          promptVersion,
          prompt,
          rawResponse: '',
          parsedOk: false,
          errorKind: AiGenerationErrorKind.PROVIDER_ERROR,
          errorDetail: err instanceof Error ? err.message : String(err),
          latencyMs: Date.now() - startedAt,
          attempt,
          ctx,
        });
        throw err;
      }

      const latencyMs = Date.now() - startedAt;

      try {
        const parsed = PromptManager.parse(stage, result.content);
        await this.audit.record({
          stage,
          promptVersion,
          prompt,
          rawResponse: result.content,
          parsedOk: true,
          latencyMs,
          attempt,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          model: result.model,
          ctx,
        });
        return parsed;
      } catch (err) {
        const contractError =
          err instanceof AiContractError
            ? err
            : new AiContractError(String(err), stage, 'schema_mismatch', result.content, []);

        lastError = contractError;

        await this.audit.record({
          stage,
          promptVersion,
          prompt,
          rawResponse: result.content,
          parsedOk: false,
          errorKind: this.errorKindOf(contractError),
          errorDetail: contractError.issues
            .map((issue) => `${issue.path}: ${issue.message}`)
            .join('; ')
            .slice(0, 1000),
          latencyMs,
          attempt,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          model: result.model,
          ctx,
        });

        if (attempt < MAX_ATTEMPTS) {
          prompt = `${basePrompt}\n\n上一次的返回不符合约定，请修正以下问题后重新输出完整 JSON：\n${contractError.issues
            .map((issue) => `- ${issue.path}: ${issue.message}`)
            .join('\n')}\n`;
        }
      }
    }

    throw lastError ?? new AiContractError('AI 输出不符合约定', stage, 'schema_mismatch', '');
  }

  private errorKindOf(err: AiContractError): AiGenerationErrorKind {
    switch (err.kind) {
      case 'invalid_json':
        return AiGenerationErrorKind.INVALID_JSON;
      case 'truncated':
        return AiGenerationErrorKind.TRUNCATED;
      default:
        return AiGenerationErrorKind.SCHEMA_MISMATCH;
    }
  }

  // ── 以下为各 stage 的薄封装：签名末尾追加 ctx（默认 {} 便于分批迁移） ──

  async generateKnowledgePoints(
    input: { title: string; description?: string; type: TreeType; keywords?: string },
    ctx: AiCallContext = {},
  ): Promise<{ points: string[] }> {
    return this.generate('knowledge-points', input, ctx);
  }

  async generateL1(
    title: string,
    description: string | undefined,
    type: TreeType,
    ctx: AiCallContext = {},
  ) {
    return this.generate('l1-outline', { title, description, type }, ctx);
  }

  async generateL1FromPoints(
    title: string,
    description: string | undefined,
    type: TreeType,
    selectedPoints: string[],
    ctx: AiCallContext = {},
  ) {
    return this.generate('l1-outline', { title, description, type, selectedPoints }, ctx);
  }

  async generateL2(
    l1Title: string,
    l1Description: string,
    skillTreeName: string,
    ctx: AiCallContext = {},
  ) {
    return this.generate('l2-nodes', { l1Title, l1Description, skillTreeName }, ctx);
  }

  async generateL3CoreText(
    input: { skillTreeName: string; l1Title: string; l2Title: string },
    ctx: AiCallContext = {},
  ) {
    return this.generate('l3-core-text', input, ctx, { maxTokens: this.l3MaxTokens() });
  }

  async generateL3CodeExamples(
    input: { skillTreeName: string; l1Title: string; l2Title: string; coreText: string },
    ctx: AiCallContext = {},
  ) {
    return this.generate('l3-code-examples', input, ctx, { maxTokens: this.l3MaxTokens() });
  }

  async generateL3Exercises(
    input: { skillTreeName: string; l1Title: string; l2Title: string; coreText: string },
    ctx: AiCallContext = {},
  ) {
    return this.generate('l3-exercises', input, ctx, { maxTokens: this.l3MaxTokens() });
  }

  async generateInterviewQA(
    input: { treeName: string; l1Title: string; l2Title: string; l2Description?: string },
    ctx: AiCallContext = {},
  ) {
    return this.generate('interview-qa', input, ctx);
  }

  async generatePortrait(
    input: {
      identityAnswers: string[];
      interestAnswers: string[];
      goalAnswers: string[];
      backgroundAnswers: string[];
    },
    ctx: AiCallContext = {},
  ) {
    return this.generate('portrait', input, ctx);
  }

  async generateDiscoverNew(input: DiscoveryNodeInput, ctx: AiCallContext = {}) {
    return this.generate('discover-new', input, ctx);
  }

  async generateCheckExpire(input: DiscoveryNodeInput, ctx: AiCallContext = {}) {
    return this.generate('check-expire', input, ctx);
  }

  async generateRecommendations(
    input: {
      portrait: Record<string, unknown>;
      learningSkills: { name: string; type: string; description?: string }[];
      oldRecommendations: { title: string; reason: string }[];
    },
    ctx: AiCallContext = {},
  ) {
    return this.generate('recommendations', input, ctx);
  }
}
