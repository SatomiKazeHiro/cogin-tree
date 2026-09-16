import OpenAI from 'openai';
import {
  AIProviderCallOptions,
  AIProviderResult,
  IAIProvider,
  AIProviderOptions,
} from '../ai-provider.interface';

export class DeepseekProvider implements IAIProvider {
  private client: OpenAI;
  private model: string;

  constructor(options: AIProviderOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseUrl || 'https://api.deepseek.com',
    });
    this.model = options.model;
  }

  async chat(prompt: string, options?: AIProviderCallOptions): Promise<AIProviderResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Always return valid JSON matching the requested schema, without markdown formatting or explanations.' },
        { role: 'user', content: prompt },
      ],
      temperature: options?.temperature ?? 0.7,
      // 推理模型（如 deepseek-v4-flash）会先消耗大量 reasoning tokens，
      // 默认额度过小会导致正文被截断为空，因此默认给到 8192
      max_tokens: options?.maxTokens ?? 8192,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from DeepSeek');
    }

    return {
      content,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
      model: response.model || this.model,
    };
  }
}
