import { MockProvider } from '@skill/ai-provider';

describe('IAIProvider 契约', () => {
  it('chat 返回带 content 的结果对象（用量字段可选）', async () => {
    const provider = new MockProvider();
    const result = await provider.chat('L3 学习内容 请生成 coreText');

    expect(typeof result.content).toBe('string');
    expect(result.content.length).toBeGreaterThan(0);
    expect(
      result.promptTokens === undefined || typeof result.promptTokens === 'number',
    ).toBe(true);
  });
});
