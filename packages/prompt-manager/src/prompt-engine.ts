export interface PromptTemplate<TInput, TOutput> {
  version: string;
  build: (input: TInput) => string;
  parse: (raw: string) => TOutput;
}

export class JsonParseError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
    public readonly extracted: string,
  ) {
    super(message);
    this.name = 'JsonParseError';
  }
}

function stripMarkdownCodeBlock(raw: string): string {
  const cleaned = raw.trim();
  // Match an optional fenced code block and return its content.
  // We use a stricter anchor: the block must start at the beginning of the response.
  const fenceMatch = cleaned.match(/^```(?:json|javascript|js)?\s*\n?([\s\S]*?)```\s*$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return cleaned;
}

function findBalancedJson(raw: string): string | null {
  // Scan the raw text for the first balanced { } or [ ] region that JSON.parse accepts.
  // This is a fallback when the model wraps JSON in explanatory text or when inner
  // code blocks break a naive regex extraction.
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch !== '{' && ch !== '[') continue;

    const stack: string[] = [];
    let inString = false;
    let escape = false;
    let start = i;

    for (let j = i; j < raw.length; j++) {
      const c = raw[j];
      if (inString) {
        if (escape) {
          escape = false;
          continue;
        }
        if (c === '\\') {
          escape = true;
          continue;
        }
        if (c === '"') {
          inString = false;
        }
        continue;
      }

      if (c === '"') {
        inString = true;
        continue;
      }

      if (c === '{' || c === '[') {
        stack.push(c);
      } else if (c === '}' || c === ']') {
        const open = stack.pop();
        if (!open) break;
        if ((open === '{' && c !== '}') || (open === '[' && c !== ']')) {
          break;
        }
        if (stack.length === 0) {
          const candidate = raw.slice(start, j + 1);
          try {
            JSON.parse(candidate);
            return candidate;
          } catch {
            // Not valid JSON, keep scanning
            break;
          }
        }
      }
    }
  }
  return null;
}

function looksTruncated(jsonString: string): boolean {
  const unquoted = jsonString.replace(/"(?:\\.|[^"\\])*"/g, '');
  const openBraces = (unquoted.match(/\{/g) || []).length;
  const closeBraces = (unquoted.match(/\}/g) || []).length;
  const openBrackets = (unquoted.match(/\[/g) || []).length;
  const closeBrackets = (unquoted.match(/\]/g) || []).length;
  return openBraces > closeBraces || openBrackets > closeBrackets;
}

export function extractJson<T>(raw: string): T {
  const cleaned = raw.trim();
  let jsonString = stripMarkdownCodeBlock(cleaned);

  try {
    return JSON.parse(jsonString) as T;
  } catch {
    // Ignore and try the fallback scanner.
  }

  const balanced = findBalancedJson(cleaned);
  if (balanced) {
    try {
      return JSON.parse(balanced) as T;
    } catch {
      // Fall through to error reporting with the original fenced content.
    }
  }

  // 将原始响应与提取后的字符串打印出来，便于定位模型输出的具体错误
  console.error('[extractJson] Failed to parse JSON. Raw response length:', raw.length);
  console.error('[extractJson] Extracted JSON string (first 2000 chars):', jsonString.slice(0, 2000));

  if (looksTruncated(jsonString)) {
    throw new JsonParseError(
      'AI 返回的内容似乎被截断了（JSON 未闭合）。请尝试增大 AI_L3_MAX_TOKENS 后重试。',
      raw,
      jsonString,
    );
  }

  throw new JsonParseError(
    'AI 返回的内容无法解析为合法 JSON，请检查模型输出格式。',
    raw,
    jsonString,
  );
}
