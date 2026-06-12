import OpenAI from 'openai';
import { IAIProvider, AIProviderOptions } from '../ai-provider.interface';

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

  async chat(prompt: string, options?: { temperature?: number; maxTokens?: number }): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Always return valid JSON matching the requested schema, without markdown formatting or explanations.' },
        { role: 'user', content: prompt },
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from DeepSeek');
    }
    return content;
  }
}
