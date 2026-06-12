export interface IAIProvider {
  chat(prompt: string, options?: { temperature?: number; maxTokens?: number }): Promise<string>;
}

export interface AIProviderOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
}
