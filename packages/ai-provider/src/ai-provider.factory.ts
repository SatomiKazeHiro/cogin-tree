import { AIProviderType } from '@skill/shared';
import { IAIProvider, AIProviderOptions } from './ai-provider.interface';
import { DeepseekProvider } from './providers/deepseek.provider';
import { MockProvider } from './providers/mock.provider';

export class AIProviderFactory {
  static create(provider: AIProviderType, options?: AIProviderOptions): IAIProvider {
    switch (provider) {
      case AIProviderType.DEEPSEEK:
      case AIProviderType.OPENAI:
        if (!options?.apiKey) {
          throw new Error(`API key is required for ${provider}`);
        }
        return new DeepseekProvider(options);
      case AIProviderType.MOCK:
        return new MockProvider();
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }
}
