import { ConfigService } from '@nestjs/config';
import { AiContractError } from '@skill/prompt-manager';
import { AiIntegrationService } from './ai-integration.service';

describe('AiIntegrationService（契约失败重试 + 审计）', () => {
  let service: AiIntegrationService;
  let provider: { chat: jest.Mock };
  let audit: { record: jest.Mock };
  let config: ConfigService;

  const goodPoints = JSON.stringify({ points: ['a', 'b'] });
  const badPoints = JSON.stringify({ points: 'not-an-array' });

  beforeEach(() => {
    provider = { chat: jest.fn() };
    audit = { record: jest.fn(async () => undefined) };
    config = {
      get: jest.fn((key: string) =>
        ({ AI_PROVIDER: 'deepseek', AI_MODEL: 'deepseek-v4-flash' })[key],
      ),
    } as never;

    service = new AiIntegrationService(config, audit as never);
    jest.spyOn(service, 'getProvider').mockResolvedValue(provider as never);
  });

  it('形状正确时一次成功，落一条 parsedOk=true 的审计', async () => {
    provider.chat.mockResolvedValue({ content: goodPoints, promptTokens: 10, completionTokens: 20 });

    const result = await service.generate(
      'knowledge-points',
      { title: 'T', type: 'ENTRY' },
      { userId: 'u1' },
    );

    expect(result.points).toEqual(['a', 'b']);
    expect(provider.chat).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedOk: true,
        attempt: 1,
        stage: 'knowledge-points',
        promptVersion: expect.any(String),
        promptTokens: 10,
        completionTokens: 20,
      }),
    );
  });

  it('第一次形状错误 → 带 issues 反馈重试一次 → 第二次成功', async () => {
    provider.chat
      .mockResolvedValueOnce({ content: badPoints })
      .mockResolvedValueOnce({ content: goodPoints });

    const result = await service.generate(
      'knowledge-points',
      { title: 'T', type: 'ENTRY' },
      {},
    );

    expect(result.points).toHaveLength(2);
    expect(provider.chat).toHaveBeenCalledTimes(2);

    // 第二次调用的提示词包含第一次的错误反馈
    const secondPrompt = provider.chat.mock.calls[1][0] as string;
    expect(secondPrompt).toContain('上一次');

    // 第二次的温度更低（更保守）
    expect(provider.chat.mock.calls[1][1]).toMatchObject({ temperature: 0.3 });

    // 两次调用各落一条审计
    expect(audit.record).toHaveBeenCalledTimes(2);
    expect(audit.record.mock.calls[0][0]).toMatchObject({ parsedOk: false, attempt: 1 });
    expect(audit.record.mock.calls[1][0]).toMatchObject({ parsedOk: true, attempt: 2 });
  });

  it('两次都失败 → 抛 AiContractError，且两条审计均 parsedOk=false', async () => {
    provider.chat.mockResolvedValue({ content: badPoints });

    await expect(
      service.generate('knowledge-points', { title: 'T', type: 'ENTRY' }, {}),
    ).rejects.toBeInstanceOf(AiContractError);

    expect(provider.chat).toHaveBeenCalledTimes(2);
    expect(audit.record).toHaveBeenCalledTimes(2);
    expect(audit.record.mock.calls.every((c) => c[0].parsedOk === false)).toBe(true);
  });

  it('provider 抛错（网络/超时）→ 不重试，落一条 provider_error 审计后向上抛', async () => {
    provider.chat.mockRejectedValue(new Error('ECONNRESET'));

    await expect(
      service.generate('knowledge-points', { title: 'T', type: 'ENTRY' }, {}),
    ).rejects.toThrow('ECONNRESET');

    expect(provider.chat).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ parsedOk: false, errorKind: 'provider_error' }),
    );
  });
});
