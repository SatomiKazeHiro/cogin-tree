import { AiGenerationService } from './ai-generation.service';
import { AiGenerationErrorKind } from '@skill/shared';

describe('AiGenerationService', () => {
  let service: AiGenerationService;
  let repo: { create: jest.Mock; save: jest.Mock };
  let originalProvider: string | undefined;
  let originalModel: string | undefined;

  beforeEach(() => {
    originalProvider = process.env.AI_PROVIDER;
    originalModel = process.env.AI_MODEL;
    process.env.AI_PROVIDER = 'deepseek';
    process.env.AI_MODEL = 'deepseek-v4-flash';
    repo = { create: jest.fn((v) => v), save: jest.fn(async (v) => v) };
    service = new AiGenerationService(repo as never);
  });

  afterEach(() => {
    process.env.AI_PROVIDER = originalProvider;
    process.env.AI_MODEL = originalModel;
  });

  it('记录成功调用：parsedOk=true、无 errorKind、带耗时与用量', async () => {
    await service.record({
      stage: 'l3-content',
      promptVersion: '2.0.0',
      prompt: 'p',
      rawResponse: '{"a":1}',
      parsedOk: true,
      latencyMs: 1234,
      attempt: 1,
      promptTokens: 100,
      completionTokens: 200,
      ctx: { userId: 'u1', treeId: 't1', nodeId: 'n1' },
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'l3-content',
        promptVersion: '2.0.0',
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        parsedOk: true,
        latencyMs: 1234,
        attempt: 1,
        promptTokens: 100,
        completionTokens: 200,
        userId: 'u1',
        treeId: 't1',
        nodeId: 'n1',
      }),
    );
  });

  it('记录失败调用：parsedOk=false 且带 errorKind/detail', async () => {
    await service.record({
      stage: 'l3-content',
      promptVersion: '2.0.0',
      prompt: 'p',
      rawResponse: 'bad',
      parsedOk: false,
      errorKind: AiGenerationErrorKind.SCHEMA_MISMATCH,
      errorDetail: '/exercises/0/correctIndex: too big',
      latencyMs: 10,
      attempt: 2,
      ctx: {},
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedOk: false,
        errorKind: AiGenerationErrorKind.SCHEMA_MISMATCH,
        errorDetail: '/exercises/0/correctIndex: too big',
        attempt: 2,
      }),
    );
  });

  it('context 缺省时把关联列写为 null（而非 undefined）', async () => {
    await service.record({
      stage: 'portrait',
      promptVersion: '2.0.0',
      prompt: 'p',
      rawResponse: '{}',
      parsedOk: true,
      latencyMs: 1,
      attempt: 1,
      ctx: {},
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, treeId: null, nodeId: null }),
    );
  });

  it('request_hash 由 prompt 派生（同一 prompt 得到同一 hash）', async () => {
    await service.record({
      stage: 'portrait',
      promptVersion: '2.0.0',
      prompt: 'same-prompt',
      rawResponse: '{}',
      parsedOk: true,
      latencyMs: 1,
      attempt: 1,
      ctx: {},
    });
    const first = repo.create.mock.calls[0][0].requestHash;

    await service.record({
      stage: 'portrait',
      promptVersion: '2.0.0',
      prompt: 'same-prompt',
      rawResponse: '{}',
      parsedOk: true,
      latencyMs: 1,
      attempt: 1,
      ctx: {},
    });
    const second = repo.create.mock.calls[1][0].requestHash;

    expect(first).toBe(second);
    expect(typeof first).toBe('string');
    expect(first.length).toBeGreaterThan(8);
  });

  it('审计写入失败不抛错（绝不因审计影响业务主流程）', async () => {
    repo.save.mockRejectedValue(new Error('DB down'));

    await expect(
      service.record({
        stage: 'portrait',
        promptVersion: '2.0.0',
        prompt: 'p',
        rawResponse: '{}',
        parsedOk: true,
        latencyMs: 1,
        attempt: 1,
        ctx: {},
      }),
    ).resolves.toBeUndefined();
  });
});
