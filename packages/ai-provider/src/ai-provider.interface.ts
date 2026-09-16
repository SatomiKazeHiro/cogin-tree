export interface IAIProvider {
  chat(prompt: string, options?: AIProviderCallOptions): Promise<AIProviderResult>;
}

export interface AIProviderOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface AIProviderCallOptions {
  temperature?: number;
  maxTokens?: number;
}

/**
 * 一次 AI 调用的结果。
 * 用量字段可选（供应商未返回时为 undefined），用于 ai_generations 的成本统计。
 */
export interface AIProviderResult {
  content: string;
  promptTokens?: number;
  completionTokens?: number;
  model?: string;
}
