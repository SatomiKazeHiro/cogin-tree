import { Injectable } from '@nestjs/common';
import { AIProviderFactory, IAIProvider } from '@skill/ai-provider';
import { PromptManager } from '@skill/prompt-manager';
import { AIProviderConfig, AIProviderType } from '@skill/shared';
import { GlobalConfigService } from '../config/config.service';

@Injectable()
export class AiIntegrationService {
  constructor(private readonly configService: GlobalConfigService) {}

  async getProvider(): Promise<IAIProvider> {
    const config = await this.configService.getAIConfig();
    const providerConfig: AIProviderConfig = {
      provider: (config?.provider as AIProviderType) || AIProviderType.MOCK,
      apiKey: (config?.apiKey as string) || '',
      model: (config?.model as string) || 'deepseek-chat',
      baseUrl: config?.baseUrl as string | undefined,
    };
    return AIProviderFactory.create(providerConfig.provider, providerConfig);
  }

  async generatePortrait(context: {
    identityAnswers: string[];
    interestAnswers: string[];
    goalAnswers: string[];
    backgroundAnswers: string[];
  }): Promise<Record<string, unknown>> {
    const prompt = PromptManager.build('portrait', context);
    const provider = await this.getProvider();
    const raw = await provider.chat(prompt);
    return PromptManager.parse('portrait', raw) as Record<string, unknown>;
  }

  async generateL1(title: string, description?: string): Promise<{ nodes: { title: string; description: string }[] }> {
    const prompt = PromptManager.build('l1-outline', { title, description, type: 'ENTRY' });
    const provider = await this.getProvider();
    const raw = await provider.chat(prompt);
    return PromptManager.parse('l1-outline', raw) as { nodes: { title: string; description: string }[] };
  }

  async generateL2(
    l1Title: string,
    l1Description: string,
    skillTreeName: string,
  ): Promise<{ nodes: { title: string; description: string }[] }> {
    const prompt = PromptManager.build('l2-nodes', { l1Title, l1Description, skillTreeName });
    const provider = await this.getProvider();
    const raw = await provider.chat(prompt);
    return PromptManager.parse('l2-nodes', raw) as { nodes: { title: string; description: string }[] };
  }

  async generateL3(
    l1Title: string,
    l2Title: string,
    skillTreeName: string,
  ): Promise<{
    coreText: string;
    codeExamples: { title: string; language: string; code: string }[];
    exercises: { question: string; options: string[]; correctIndex: number; explanation: string }[];
  }> {
    const prompt = PromptManager.build('l3-content', { l1Title, l2Title, skillTreeName });
    const provider = await this.getProvider();
    const raw = await provider.chat(prompt);
    return PromptManager.parse('l3-content', raw) as {
      coreText: string;
      codeExamples: { title: string; language: string; code: string }[];
      exercises: { question: string; options: string[]; correctIndex: number; explanation: string }[];
    };
  }
}
