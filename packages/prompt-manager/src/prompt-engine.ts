export interface PromptTemplate<TInput, TOutput> {
  version: string;
  build: (input: TInput) => string;
  parse: (raw: string) => TOutput;
}

export function extractJson<T>(raw: string): T {
  const cleaned = raw.trim();
  const match = cleaned.match(/```(?:json|javascript|js)?\s*([\s\S]*?)```/);
  const jsonString = match ? match[1].trim() : cleaned;
  return JSON.parse(jsonString);
}
