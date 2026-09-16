import * as z from 'zod';

export interface PromptTemplate<TInput, TOutput> {
  version: string;
  /** 契约唯一来源：既做运行时校验，又派生提示词里的格式说明 */
  schema: z.ZodType<TOutput>;
  build: (input: TInput) => string;
  parse: (raw: string) => TOutput;
}

export class JsonParseError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
    public readonly extracted: string,
    /** 判别截断 vs 其他语法错误，供契约层归类（不必匹配消息文本） */
    public readonly reason: 'truncated' | 'invalid' = 'invalid',
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
      'truncated',
    );
  }

  throw new JsonParseError(
    'AI 返回的内容无法解析为合法 JSON，请检查模型输出格式。',
    raw,
    jsonString,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 契约层：把 AI 输出当外部输入校验
// ─────────────────────────────────────────────────────────────────────

export interface ContractIssue {
  path: string;
  message: string;
}

/** 契约层错误：AI 输出与约定不符（语法、形状或跨字段不变量） */
export class AiContractError extends Error {
  constructor(
    message: string,
    public readonly stage: string,
    public readonly kind: 'invalid_json' | 'truncated' | 'schema_mismatch',
    public readonly raw: string,
    public readonly issues: ContractIssue[] = [],
  ) {
    super(message);
    this.name = 'AiContractError';
  }
}

export interface TemplateDefinition<TInput, TOutput> {
  version: string;
  schema: z.ZodType<TOutput>;
  /**
   * 跨字段不变量（JSON Schema 无法表达），在形状校验通过后执行。
   * 返回违规说明列表，空数组表示通过。
   *
   * 为什么不用 .refine()：zod 文档明确 .transform()/z.custom()/z.date() 等类型在
   * z.toJSONSchema 下会抛错，而未说明 .refine() 这类检查的行为（可能被静默忽略）。
   * 为保证「提示词里的格式说明」始终完整可信，schema 一律保持 JSON-Schema 可表示。
   */
  invariants?: (value: TOutput) => string[];
  /** 提示词正文；输出格式段由 defineTemplate 自动追加，不要再手写 */
  body: (input: TInput) => string;
  /** stage 名，用于错误归类与审计 */
  stage?: string;
}

/** 由 schema 派生提示词中的输出格式段——同源，故不可能与校验漂移 */
export function outputFormatSection(schema: z.ZodType): string {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-07', io: 'output' });
  return [
    '输出格式（必须严格遵循，只输出如下 JSON 对象本身，不要包裹 Markdown 代码块、不要添加解释）：',
    '```json',
    JSON.stringify(jsonSchema, null, 2),
    '```',
    '重要转义规则：JSON 字符串内的双引号必须转义为 \\"，真实换行必须写成 \\n，反斜杠必须写成 \\\\；不要出现尾随逗号。',
  ].join('\n');
}

/** 契约校验统一入口：形状（zod）→ 跨字段不变量 → 类型化结果 */
export function parseWithSchema<TOut>(
  schema: z.ZodType<TOut>,
  raw: string,
  stage = 'unknown',
  invariants?: (value: TOut) => string[],
): TOut {
  let value: TOut;

  try {
    value = schema.parse(extractJson(raw));
  } catch (err) {
    if (err instanceof JsonParseError) {
      throw new AiContractError(
        err.message,
        stage,
        err.reason === 'truncated' ? 'truncated' : 'invalid_json',
        raw,
        [{ path: '(root)', message: err.message }],
      );
    }
    if (err instanceof z.ZodError) {
      const issues: ContractIssue[] = err.issues.map((issue) => ({
        path: issue.path.map(String).join('/') || '(root)',
        message: issue.message,
      }));
      throw new AiContractError(
        `AI 输出不符合约定的结构（stage=${stage}）`,
        stage,
        'schema_mismatch',
        raw,
        issues,
      );
    }
    throw err;
  }

  const violations = invariants ? invariants(value) : [];
  if (violations.length > 0) {
    throw new AiContractError(
      `AI 输出违反了跨字段约定（stage=${stage}）`,
      stage,
      'schema_mismatch',
      raw,
      violations.map((message) => ({ path: '(invariant)', message })),
    );
  }

  return value;
}

const STAGE_NAMES = new WeakMap<object, string>();

/** 组装模板：自动追加格式段、生成 parse */
export function defineTemplate<TIn, TOut>(
  def: TemplateDefinition<TIn, TOut>,
): PromptTemplate<TIn, TOut> {
  const template: PromptTemplate<TIn, TOut> = {
    version: def.version,
    schema: def.schema,
    build: (input) => `${def.body(input).trimEnd()}\n\n${outputFormatSection(def.schema)}`,
    parse: (raw) => parseWithSchema(def.schema, raw, def.stage ?? 'unknown', def.invariants),
  };
  if (def.stage) {
    STAGE_NAMES.set(template, def.stage);
  }
  return template;
}

/** 取模板声明的 stage 名（未声明时返回 'unknown'） */
export function stageNameOf(template: PromptTemplate<unknown, unknown>): string {
  return STAGE_NAMES.get(template) ?? 'unknown';
}
