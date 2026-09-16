import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProviderFactory, IAIProvider } from '@skill/ai-provider';
import { PromptManager } from '@skill/prompt-manager';
import { AIProviderConfig, AIProviderType, TreeType } from '@skill/shared';

@Injectable()
export class AiIntegrationService {
  constructor(private readonly configService: ConfigService) {}

  async getProvider(): Promise<IAIProvider> {
    const providerConfig: AIProviderConfig = {
      provider: (this.configService.get<string>('AI_PROVIDER') as AIProviderType) || AIProviderType.MOCK,
      apiKey: this.configService.get<string>('AI_API_KEY') || '',
      model: this.configService.get<string>('AI_MODEL') || 'deepseek-chat',
      baseUrl: this.configService.get<string>('AI_BASE_URL'),
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

  async generateL1(title: string, description: string | undefined, type: TreeType): Promise<{ nodes: { title: string; description: string }[] }> {
    const prompt = PromptManager.build('l1-outline', { title, description, type });
    const provider = await this.getProvider();
    const raw = await provider.chat(prompt);
    return PromptManager.parse('l1-outline', raw) as { nodes: { title: string; description: string }[] };
  }

  async generateL1FromPoints(
    title: string,
    description: string | undefined,
    type: TreeType,
    selectedPoints: string[],
  ): Promise<{ nodes: { title: string; description: string }[] }> {
    const prompt = PromptManager.build('l1-outline', { title, description, type, selectedPoints });
    const provider = await this.getProvider();
    const raw = await provider.chat(prompt);
    return PromptManager.parse('l1-outline', raw) as { nodes: { title: string; description: string }[] };
  }

  async generateKnowledgePoints(input: {
    title: string;
    description?: string;
    type: TreeType;
    keywords?: string;
  }): Promise<{ points: string[] }> {
    const prompt = PromptManager.build('knowledge-points', input);
    const provider = await this.getProvider();
    const raw = await provider.chat(prompt);
    return PromptManager.parse('knowledge-points', raw) as { points: string[] };
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
    const maxTokensRaw = this.configService.get<string>('AI_L3_MAX_TOKENS');
    const maxTokens = maxTokensRaw ? parseInt(maxTokensRaw, 10) || 4096 : 4096;
    const raw = await provider.chat(prompt, { maxTokens });
    return PromptManager.parse('l3-content', raw) as {
      coreText: string;
      codeExamples: { title: string; language: string; code: string }[];
      exercises: { question: string; options: string[]; correctIndex: number; explanation: string }[];
    };
  }

  async generateInterviewQA(input: {
    treeName: string;
    l1Title: string;
    l2Title: string;
    l2Description?: string;
  }): Promise<{
    questions: {
      question: string;
      answer: string;
      difficulty: string;
    }[];
  }> {
    const prompt = PromptManager.build('interview-qa', input);
    const provider = await this.getProvider();
    const raw = await provider.chat(prompt);
    return PromptManager.parse('interview-qa', raw) as {
      questions: {
        question: string;
        answer: string;
        difficulty: string;
      }[];
    };
  }

  async generateDiscoverNew(input: {
    treeName: string;
    treeType?: string;
    nodes: { level: number; title: string; description?: string; parentTitle?: string }[];
  }): Promise<{
    suggestions: { parentTitle?: string | null; title: string; description: string; reason: string }[];
  }> {
    const prompt = PromptManager.build('discover-new', input);
    const provider = await this.getProvider();
    const raw = await provider.chat(prompt);
    return PromptManager.parse('discover-new', raw) as {
      suggestions: { parentTitle?: string | null; title: string; description: string; reason: string }[];
    };
  }

  async generateCheckExpire(input: {
    treeName: string;
    treeType?: string;
    nodes: { level: number; title: string; description?: string; parentTitle?: string }[];
  }): Promise<{
    suggestions: { nodeTitle: string; expireLevel: 1 | 2 | 3; reason: string }[];
  }> {
    const prompt = PromptManager.build('check-expire', input);
    const provider = await this.getProvider();
    const raw = await provider.chat(prompt);
    return PromptManager.parse('check-expire', raw) as {
      suggestions: { nodeTitle: string; expireLevel: 1 | 2 | 3; reason: string }[];
    };
  }

  async generateRecommendations(context: {
    portrait: Record<string, unknown>;
    learningSkills: { name: string; type: string; description?: string }[];
    oldRecommendations: { title: string; reason: string }[];
  }): Promise<{
    recommendations: {
      title: string;
      description: string;
      reason: string;
      matchTags: string[];
      suggestedMode: string;
      keywords: string[];
    }[];
  }> {
    const prompt = PromptManager.build('recommendations', context);
    const provider = await this.getProvider();
    const raw = await provider.chat(prompt);
    return PromptManager.parse('recommendations', raw) as {
      recommendations: {
        title: string;
        description: string;
        reason: string;
        matchTags: string[];
        suggestedMode: string;
        keywords: string[];
      }[];
    };
  }
}
