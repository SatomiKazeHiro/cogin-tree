# 计划 B 实施计划：AI 契约层（阶段 3）

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 AI 输出从"隐式 schema"变成可执行契约——一份 zod schema 同时产出运行时校验与提示词里的格式说明；形状错误抛结构化错误且不落库；三处写路径改为「先算后落库」的原子写入；每次 AI 调用落 `ai_generations` 供审计与成本统计。

**Architecture:** 契约与模板**同居**在 `packages/prompt-manager`：每个 stage 文件导出 `schema`（zod）、`body`（提示词正文）、`invariants`（JSON Schema 无法表达的跨字段校验）；`defineTemplate()` 负责自动追加格式段（由 `z.toJSONSchema` 生成）并生成 `parse`。`PromptManager` 改为**模板注册表**，`parse/build` 由注册表推导类型（消灭 switch 与 `as` 断言）。`apps/api` 的 `ai-integration` 收敛为**一个泛型调用 helper**：调用 provider → 落审计 → 契约校验 → 失败带反馈重试一次。

**Tech Stack:** zod ^4（内置 `z.toJSONSchema()`）· NestJS 10 · TypeORM 0.3.20 · PostgreSQL 18.4 · ts-jest · ts-node

**Spec:** `docs/specs/2026-09-16-ai-contract-and-dataflow-design.md`（第 3 节为本计划的直接依据）

**前置计划：** `docs/plans/2026-09-16-phase1-2-schema-and-authz.md`（已完成，`ai_generations` 表已建）
**验证记录：** `docs/plans/2026-09-16-phase1-2-verification.md`（第四节「沙箱环境知识」务必先读）

## Global Constraints

- Node.js >= 20；pnpm 9.0.0；zod 只加到 `packages/prompt-manager`（apps/api 不直接依赖它）
- **沙箱内 pnpm 需覆盖 `PNPM_HOME`**：`$env:PNPM_HOME = Join-Path (Get-Location) ".pnpm-home"`
- **`pnpm <script>` 不可用**（打包二进制 spawnSync 捕获输出被沙箱拒绝 → EPERM）。一律直接调用 `node_modules/.bin/*`
  - **注意 bin 的位置**：根 `node_modules/.bin` **只有 `tsc`**；`ts-node` / `jest` / `nest` / `typeorm` 都装在
    `apps/api/node_modules/.bin`（pnpm 严格隔离）。从 `packages/*` 里调用 ts-node 必须写成
    `..\..\apps\api\node_modules\.bin\ts-node`
- **构建 shared / prompt-manager 用 tsc 直接调用**（不用 `pnpm --filter X build`，它内含 `rm -rf`）：
  - `packages/shared`：`tsc -p packages/shared/tsconfig.json && tsc -p packages/shared/tsconfig.cjs.json`
  - `packages/prompt-manager`：`tsc -p packages/prompt-manager/tsconfig.json`
- **改了 `packages/shared/src` 必须 rebuild 并同步 `src/index.ts` 的显式具名导出列表**（该文件是白名单，不是 `export *`）
- **`@skill/*` 双解析路径**：`tsc` 走 `packages/*/src`，jest/ts-node/nest 运行时走 `packages/*/dist`。只改源码不 rebuild → `tsc` 通过但运行时报「没有导出成员」
- **zod schema 必须保持 JSON-Schema 可表示**：禁止 `z.date()` / `z.transform()` / `z.custom()` / `z.bigint()` / `z.map()` / `z.set()` / `z.void()`（`z.toJSONSchema` 默认对它们抛错）
- **跨字段约束一律走 `invariants` 回调**，不使用 `.refine()`（其在 `toJSONSchema` 下的行为文档未明示，可能被静默忽略）
- 单测不连库（`new Service(...)` + mock）；Jest 必须 `--runInBand`
- 测试命令：`cd apps/api; node_modules\.bin\jest --runInBand`；类型检查：`cd apps/api; node_modules\.bin\tsc --noEmit`
- `psql -c` 里禁止中文字面量（控制台 GBK 会破坏 SQL）；需要中文时用 `-f` 执行 UTF-8 脚本
- 提交信息沿用仓库风格：`<emoji> <type>: <中文描述>`；**每个 Task 末尾单独提交**
- **阶段 3 不改动任何 HTTP 接口的请求/响应形状** → 前端零改动（这是刻意的边界）

### 环境注意：本计划唯一需要权限升级的一步

Task 1 要装 zod，而 pnpm store 在工作区外（`D:\.pnpm-store\v3`），写入会被沙箱拒绝。
若 `pnpm add` 报「拒绝访问 / EPERM」，就**对同一条命令发起一次 `sandbox_permissions` 升级**并说明理由
（这是既定边界，不要改用其他命令绕过，也不要手改 lockfile）。

---

## File Structure

### 新增

| 文件 | 职责 |
|---|---|
| `packages/prompt-manager/src/schemas/common.ts` | 复用原子 schema：`nodeItemSchema` / `outlineSchema` / `codeExampleSchema` / `exerciseSchema` / `qaItemSchema` / `suggestionBaseSchema` |
| `packages/prompt-manager/src/prompt-engine.selfcheck.ts` | 契约基座自检（`defineTemplate` / `AiContractError` / 格式段防漂移） |
| `packages/prompt-manager/src/prompt-manager.selfcheck.ts` | 注册表与类型推导自检 |
| `packages/prompt-manager/src/stages.selfcheck.ts` | 9 个 stage 的正例/反例自检 |
| `apps/api/src/modules/ai-integration/ai-generation.service.ts` | 写 `ai_generations`（审计失败不影响业务调用） |
| `apps/api/src/modules/ai-integration/ai-generation.service.spec.ts` | 审计服务单测 |
| `apps/api/src/modules/ai-integration/ai-integration.service.spec.ts` | 契约失败重试 / 审计落库 / 失败不落库 |
| `apps/api/src/modules/content/content.service.transaction.spec.ts` | 「AI 失败则事务不开启」不变量 |

### 修改

| 文件 | 变更 |
|---|---|
| `packages/prompt-manager/package.json` | +`zod` 依赖 |
| `packages/prompt-manager/src/prompt-engine.ts` | +`PromptTemplate.schema`、`TemplateDefinition`、`defineTemplate`、`AiContractError`、`outputFormatSection` |
| `packages/prompt-manager/src/templates/*.ts`（9 个） | 每个 stage 加 `schema` / `invariants`，改用 `defineTemplate`，版本升到 semver |
| `packages/prompt-manager/src/prompt-manager.ts` | 改为模板注册表 + 泛型 `build` / `parse` |
| `packages/prompt-manager/src/index.ts` | 导出新增符号与 stage 输出类型 |
| `packages/ai-provider/src/ai-provider.interface.ts` | `chat` 返回值由 `string` 改为 `AIProviderResult`（带用量） |
| `packages/ai-provider/src/providers/deepseek.provider.ts` | 返回 `content` + `promptTokens` / `completionTokens` / `model` |
| `packages/ai-provider/src/providers/mock.provider.ts` | 返回 `{ content }`，按新契约调整（阶段 6 的 mock 文案同步） |
| `apps/api/src/modules/ai-integration/ai-integration.service.ts` | 收敛为泛型 helper + 10 个方法传 `ctx` |
| `apps/api/src/modules/ai-integration/ai-integration.module.ts` | 注册 `AiGeneration` 实体与 `AiGenerationService` |
| `apps/api/src/modules/skill-tree/skill-tree.service.ts` | `create` 改为先算后落库（单事务） |
| `apps/api/src/modules/content/content.service.ts` | `generateContent` 同上 |
| `apps/api/src/modules/portrait/portrait-ai.service.ts` | `generatePortrait` 同上 |
| 调用方 8 处（`tree-node` / `interview` / `analysis` / `recommendation` / `skill-tree`） | 传 `ctx`（`userId` / `treeId` / `nodeId`）给 ai-integration |

---

## Task 1: 引入 zod 与契约基座

**Files:**
- Modify: `packages/prompt-manager/package.json`
- Modify: `packages/prompt-manager/src/prompt-engine.ts`
- Create: `packages/prompt-manager/src/prompt-engine.selfcheck.ts`

**Interfaces:**
- Produces:
  - `PromptTemplate<TInput, TOutput>` 新增 `schema: z.ZodType<TOutput>`
  - `defineTemplate<TIn, TOut>(def: TemplateDefinition<TIn, TOut>): PromptTemplate<TIn, TOut>`
  - `AiContractError`（`stage` / `kind` / `raw` / `issues`）
  - `outputFormatSection(schema): string`

- [ ] **Step 1: 安装 zod**

```powershell
$env:PNPM_HOME = Join-Path (Get-Location) ".pnpm-home"
pnpm --filter prompt-manager add zod@^4 --store-dir "D:\.pnpm-store\v3"
```
Expected: `packages/prompt-manager/package.json` 出现 `"zod": "^4"`，且 `packages/prompt-manager/node_modules/zod` 存在。

> **两个必须注意的点（已在执行中实测踩到）**：
> 1. **必须加 `--store-dir "D:\.pnpm-store\v3"`**：覆盖 `PNPM_HOME` 会连带把默认 store 改成
>    `.pnpm-home/store/v3`，与既有 `node_modules` 的链接来源不一致 → `ERR_PNPM_UNEXPECTED_STORE`。
> 2. 该命令需要**写工作区外的 store** 且 pnpm 要 spawn node（管道 stdio），在 workspace-write 下会
>    分别撞上「拒绝访问」与 `spawnSync EPERM`。**对这条命令发起一次 `sandbox_permissions` 升级**即可通过。
>
> 安装后会看到 `openai@4.104.0` 的 peer 警告（它要 zod ^3.23.8，现有 4.6.5）。
> 经核实**无实际影响**：openai 主入口不在加载期 `require('zod')`，且 `packages/ai-provider/node_modules`
> 下没有 zod。但**禁止使用 `openai/helpers/zod`**（该入口需要 zod 3 API）。

- [ ] **Step 2: 写失败自检（基座机制）**

> **为什么用自检脚本而不是 jest**：`jest` / `ts-jest` 只装在 `apps/api`（pnpm 严格隔离，packages 下解析不到），
> 而本沙箱装新依赖需要写工作区外的 store，成本高。故 packages 侧的测试载体统一为
> **ts-node 自检脚本**（`assert()` + 失败即 `process.exit(1)`），与 `apps/api` 的 jest 测试并存。

创建 `packages/prompt-manager/src/prompt-engine.selfcheck.ts`：

```ts
import * as z from 'zod';
import { AiContractError, defineTemplate, extractJson } from './prompt-engine';

function assert(cond: boolean, label: string) {
  if (!cond) {
    console.error(`FAIL  ${label}`);
    process.exit(1);
  }
  console.log(`PASS  ${label}`);
}

const demoSchema = z.object({
  nodes: z
    .array(
      z.object({
        title: z.string().min(1).meta({ description: '标题' }),
        description: z.string().min(1).meta({ description: '一句话描述' }),
      }),
    )
    .min(1),
});

const demoTemplate = defineTemplate({
  version: '1.0.0',
  schema: demoSchema,
  body: (input: { topic: string }) => `请为「${input.topic}」生成大纲。`,
});

// ── build：正文 + 由 schema 派生的格式段 ──────────────────────────────
const prompt = demoTemplate.build({ topic: '前端工程化' });
assert(prompt.includes('请为「前端工程化」生成大纲。'), 'build 含提示词正文');
assert(prompt.includes('"nodes"'), 'build 注入 schema 的字段名 nodes');
assert(prompt.includes('"title"'), 'build 注入 schema 的字段名 title');
assert(prompt.includes('标题'), 'build 注入 .meta() 的中文 description');
assert(prompt.includes('"required"'), 'build 注入 required');

// ── parse：正例 ────────────────────────────────────────────────────
const ok = demoTemplate.parse('{"nodes":[{"title":"A","description":"a"}]}');
assert(ok.nodes[0].title === 'A', 'parse 正例返回类型化数据');

// ── parse：形状不符 → schema_mismatch + 字段级 issues ───────────────
try {
  demoTemplate.parse('{"nodes":[{"title":"A"}]}');
  assert(false, 'parse 形状不符应抛错');
} catch (err) {
  const e = err as AiContractError;
  assert(err instanceof AiContractError, 'parse 形状不符抛 AiContractError');
  assert(e.kind === 'schema_mismatch', 'shape 不符归类为 schema_mismatch');
  assert(e.issues.length > 0, 'shape 不符带字段级 issues');
  assert(e.issues.some((i) => i.path.includes('description')), 'issues 指向缺失字段 description');
}

// ── parse：JSON 语法错误 → invalid_json ────────────────────────────
try {
  demoTemplate.parse('这不是 JSON');
  assert(false, 'parse 语法错误应抛错');
} catch (err) {
  assert((err as AiContractError).kind === 'invalid_json', 'JSON 语法错误归类为 invalid_json');
}

// ── parse：JSON 被截断 → truncated ─────────────────────────────────
try {
  demoTemplate.parse('{"nodes":[{"title":"A"');
  assert(false, 'parse 截断应抛错');
} catch (err) {
  assert((err as AiContractError).kind === 'truncated', '截断归类为 truncated');
}

// ── invariants：形状通过后执行 ─────────────────────────────────────
const withInvariant = defineTemplate({
  version: '1.0.0',
  schema: z.object({ items: z.array(z.number().int().min(0)) }),
  invariants: (v) => (v.items.some((n) => n > 10) ? ['items 中的值不得超过 10'] : []),
  body: () => 'x',
});
assert(withInvariant.parse('{"items":[1,2]}').items.length === 2, 'invariants 通过时不抛错');
try {
  withInvariant.parse('{"items":[1,99]}');
  assert(false, 'invariants 违规应抛错');
} catch (err) {
  assert(
    (err as AiContractError).issues.map((i) => i.message).join().includes('不得超过 10'),
    'invariants 违规信息进入 issues',
  );
}

// ── extractJson 行为不变 ────────────────────────────────────────────
assert(
  JSON.stringify(extractJson('```json\n{"a":1}\n```')) === '{"a":1}',
  'extractJson 语法层行为不变',
);

console.log('\nSELFCHECK OK');
```

- [ ] **Step 3: 跑自检确认失败（红）**

```powershell
cd packages/prompt-manager
..\..\apps\api\node_modules\.bin\ts-node src/prompt-engine.selfcheck.ts
```
Expected: FAIL —— 编译期报 `defineTemplate` / `AiContractError` 不存在（ts-node 会先类型检查再执行），
或运行期抛 `defineTemplate is not a function`。任何一种即算「红」。

- [ ] **Step 4: 实现 `prompt-engine.ts` 的契约部分**

在 `packages/prompt-manager/src/prompt-engine.ts` 顶部加 `import * as z from 'zod';`，并追加：

```ts
export interface ContractIssue {
  path: string;
  message: string;
}

/** 契约层错误：AI 输出与约定不符 */
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
  /** 契约唯一来源：既做运行时校验，又派生提示词里的格式说明 */
  schema: z.ZodType<TOutput>;
  /** 跨字段不变量（JSON Schema 无法表达），在形状校验通过后执行；返回违规说明列表 */
  invariants?: (value: TOutput) => string[];
  /** 提示词正文；格式段由 defineTemplate 自动追加，不要再手写 */
  body: (input: TInput) => string;
  stage?: string;
}

/** 由 schema 派生提示词中的输出格式段（同源，故不可能漂移） */
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

/** 统一入口：形状校验（zod）→ 跨字段不变量 → 类型化结果 */
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
        err.message.includes('截断') ? 'truncated' : 'invalid_json',
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
```

- [ ] **Step 5: 扩展 `PromptTemplate` 并实现 `defineTemplate`**

在同文件修改接口并追加：

```ts
export interface PromptTemplate<TInput, TOutput> {
  version: string;
  schema: z.ZodType<TOutput>;
  build: (input: TInput) => string;
  parse: (raw: string) => TOutput;
}

const STAGE_NAMES = new WeakMap<object, string>();

export function defineTemplate<TIn, TOut>(def: TemplateDefinition<TIn, TOut>): PromptTemplate<TIn, TOut> {
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

export function stageNameOf(template: PromptTemplate<unknown, unknown>): string {
  return STAGE_NAMES.get(template) ?? 'unknown';
}
```

> `stage` 字段的作用：让 `parse` 抛出的 `AiContractError.stage` 有值（审计与重试反馈需要）。
> 每个 stage 文件在 `defineTemplate({ stage: 'l3-content', ... })` 里声明自己的名字。

- [ ] **Step 6: 跑自检确认通过（绿）**

```powershell
cd packages/prompt-manager
..\..\apps\api\node_modules\.bin\ts-node src/prompt-engine.selfcheck.ts
```
Expected: 全部 `PASS` + `SELFCHECK OK`（8 条断言）

- [ ] **Step 7: 类型检查 + 提交**

```powershell
node_modules\.bin\tsc -p packages/prompt-manager/tsconfig.json 2>&1 | Select-Object -First 10
cd apps/api; node_modules\.bin\tsc --noEmit
git add packages/prompt-manager
git commit -m "✨ feat: 引入 zod 契约基座（defineTemplate / AiContractError / 同源格式段）"
```

---

## Task 2: `PromptManager` 改为模板注册表（契约即类型）

**Files:**
- Modify: `packages/prompt-manager/src/prompt-manager.ts`
- Modify: `packages/prompt-manager/src/index.ts`
- Create: `packages/prompt-manager/src/prompt-manager.selfcheck.ts`

**Interfaces:**
- Produces:
  - `PROMPT_TEMPLATES`（stage → 模板的函数映射）
  - `type PromptStage = keyof typeof PROMPT_TEMPLATES`
  - `type StageOutput<K extends PromptStage> = z.infer<...>`
  - `PromptManager.build<K>(stage: K, input: StageInput<K>): string`
  - `PromptManager.parse<K>(stage: K, raw: string): StageOutput<K>`

- [ ] **Step 1: 写失败自检**

创建 `packages/prompt-manager/src/prompt-manager.selfcheck.ts`：

```ts
import { PromptManager, PROMPT_STAGES } from './prompt-manager';

function assert(cond: boolean, label: string) {
  if (!cond) {
    console.error(`FAIL  ${label}`);
    process.exit(1);
  }
  console.log(`PASS  ${label}`);
}

assert(PROMPT_STAGES.length === 9, `注册了 9 个 stage（实际 ${PROMPT_STAGES.length}）`);
assert(PROMPT_STAGES.includes('knowledge-points'), '含 knowledge-points');
assert(PROMPT_STAGES.includes('recommendations'), '含 recommendations');

const prompt = PromptManager.build('knowledge-points', {
  title: '前端工程化',
  type: 'ENTRY',
});
assert(prompt.length > 50, 'build 返回提示词');

// parse 的返回类型由注册表推导：下面这行若类型不符，tsc 会报错
const parsed = PromptManager.parse('knowledge-points', '{"points":["a","b"]}');
assert(parsed.points.length === 2, 'parse 返回类型化结果');

console.log('\nSELFCHECK OK');
```

- [ ] **Step 2: 跑自检确认失败**

```powershell
cd packages/prompt-manager
..\..\apps\api\node_modules\.bin\ts-node src/prompt-manager.selfcheck.ts
```
Expected: FAIL —— `PROMPT_STAGES` 未导出。

- [ ] **Step 3: 实现注册表**

重写 `packages/prompt-manager/src/prompt-manager.ts`：

```ts
import * as z from 'zod';
import { PromptTemplate } from './prompt-engine';
import { stage0KnowledgePoints } from './templates/stage-0-knowledge-points';
import { stage1L1Outline } from './templates/stage-1-l1-outline';
import { stage2L2Nodes } from './templates/stage-2-l2-nodes';
import { stage3L3Content } from './templates/stage-3-l3-content';
import { stage4DiscoverNew } from './templates/stage-4-discover-new';
import { stage5CheckExpire } from './templates/stage-5-check-expire';
import { stage6InterviewQA } from './templates/stage-6-interview-qa';
import { stage7Portrait } from './templates/stage-7-portrait';
import { stage8Recommendations } from './templates/stage-8-recommendations';

/**
 * 模板注册表：stage 名 → 模板。
 * 它同时是「契约即类型」的落点：build 的入参类型与 parse 的返回类型都从这里推导，
 * 因此不再需要 switch 分发，也不需要调用方写 as 断言。
 */
export const PROMPT_TEMPLATES = {
  'knowledge-points': stage0KnowledgePoints,
  'l1-outline': stage1L1Outline,
  'l2-nodes': stage2L2Nodes,
  'l3-content': stage3L3Content,
  'discover-new': stage4DiscoverNew,
  'check-expire': stage5CheckExpire,
  'interview-qa': stage6InterviewQA,
  portrait: stage7Portrait,
  recommendations: stage8Recommendations,
} as const;

export const PROMPT_STAGES = Object.keys(PROMPT_TEMPLATES) as PromptStage[];

export type PromptStage = keyof typeof PROMPT_TEMPLATES;
export type StageInput<K extends PromptStage> = Parameters<
  (typeof PROMPT_TEMPLATES)[K]['build']
>[0];
export type StageOutput<K extends PromptStage> = z.infer<
  (typeof PROMPT_TEMPLATES)[K]['schema']
>;

export class PromptManager {
  static build<K extends PromptStage>(stage: K, input: StageInput<K>): string {
    const template = PROMPT_TEMPLATES[stage] as PromptTemplate<StageInput<K>, StageOutput<K>>;
    return template.build(input);
  }

  static parse<K extends PromptStage>(stage: K, raw: string): StageOutput<K> {
    const template = PROMPT_TEMPLATES[stage] as PromptTemplate<StageInput<K>, StageOutput<K>>;
    return template.parse(raw);
  }

  static versionOf(stage: PromptStage): string {
    return PROMPT_TEMPLATES[stage].version;
  }

  static schemaOf(stage: PromptStage): z.ZodType {
    return PROMPT_TEMPLATES[stage].schema;
  }
}

export * from './prompt-engine';
export { stage0KnowledgePoints, stage1L1Outline, stage2L2Nodes, stage3L3Content, stage4DiscoverNew, stage5CheckExpire, stage6InterviewQA, stage7Portrait };
```

`packages/prompt-manager/src/index.ts`：确保导出 `PROMPT_TEMPLATES` / `PROMPT_STAGES` / `PromptStage` / `StageInput` / `StageOutput` 与 `AiContractError` / `defineTemplate`。

- [ ] **Step 4: 跑自检确认通过（含类型推导）**

```powershell
cd packages/prompt-manager
..\..\apps\api\node_modules\.bin\ts-node src/prompt-manager.selfcheck.ts
..\..\node_modules\.bin\tsc -p tsconfig.json --noEmit
```
Expected: `SELFCHECK OK`；`tsc` 无错误（若 `parse` 推导不生效，`parsed.points` 会报类型错误）

- [ ] **Step 5: 提交**

```powershell
cd apps/api; node_modules\.bin\tsc --noEmit
git add packages/prompt-manager
git commit -m "♻️ refactor: PromptManager 改为模板注册表（契约即类型，消灭 switch 与 as 断言）"
```

---

## Task 3: 生成类 stage 契约（0 / 1 / 2 / 3）

**Files:**
- Create: `packages/prompt-manager/src/schemas/common.ts`
- Modify: `packages/prompt-manager/src/templates/stage-0-knowledge-points.ts`
- Modify: `packages/prompt-manager/src/templates/stage-1-l1-outline.ts`
- Modify: `packages/prompt-manager/src/templates/stage-2-l2-nodes.ts`
- Modify: `packages/prompt-manager/src/templates/stage-3-l3-content.ts`
- Create: `packages/prompt-manager/src/stages.selfcheck.ts`

**Interfaces:**
- Consumes: `defineTemplate`（Task 1）、`PromptManager.parse`（Task 2）
- Produces：4 个 stage 的 `schema` 与 `invariants`；`StageOutput<'l3-content'>` 等具体类型

- [ ] **Step 1: 写失败自检（每 stage 正例 + 反例）**

创建 `packages/prompt-manager/src/stages.selfcheck.ts`：

```ts
import { PromptManager } from './prompt-manager';
import { AiContractError } from './prompt-engine';

function assert(cond: boolean, label: string) {
  if (!cond) {
    console.error(`FAIL  ${label}`);
    process.exit(1);
  }
  console.log(`PASS  ${label}`);
}

function expectContractError(stage: Parameters<typeof PromptManager.parse>[0], raw: string, label: string) {
  try {
    PromptManager.parse(stage as never, raw);
    assert(false, label);
  } catch (err) {
    assert(err instanceof AiContractError, label);
  }
}

// stage 0
assert(
  PromptManager.parse('knowledge-points', '{"points":["a","b"]}').points.length === 2,
  'knowledge-points 正例',
);
expectContractError('knowledge-points', '{"points":[]}', 'knowledge-points 空数组被拒');
expectContractError('knowledge-points', '{"points":[1,2]}', 'knowledge-points 元素类型错被拒');

// stage 1
assert(
  PromptManager.parse('l1-outline', '{"nodes":[{"title":"A","description":"a"}]}').nodes.length === 1,
  'l1-outline 正例',
);
expectContractError('l1-outline', '{"nodes":[{"title":"A"}]}', 'l1-outline 缺 description 被拒');
expectContractError('l1-outline', '{"nodes":[]}', 'l1-outline 空数组被拒');

// stage 2
assert(
  PromptManager.parse('l2-nodes', '{"nodes":[{"title":"A","description":"a"}]}').nodes.length === 1,
  'l2-nodes 正例',
);

// stage 3
const l3Ok = JSON.stringify({
  coreText: '# 标题\n正文',
  codeExamples: [{ title: '示例', language: 'ts', code: 'const a = 1;' }],
  exercises: [{ question: 'Q', options: ['a', 'b'], correctIndex: 1, explanation: 'E' }],
});
const l3 = PromptManager.parse('l3-content', l3Ok);
assert(l3.exercises.length === 1, 'l3-content 正例');
assert(l3.codeExamples[0].language === 'ts', 'l3-content codeExamples 形状正确');

expectContractError(
  'l3-content',
  JSON.stringify({ coreText: 'x', codeExamples: [], exercises: [{ question: 'Q', options: ['a'], correctIndex: 0, explanation: 'E' }] }),
  'l3-content 单选题少于 2 个选项被拒',
);
expectContractError(
  'l3-content',
  JSON.stringify({ coreText: 'x', codeExamples: [], exercises: [{ question: 'Q', options: ['a', 'b'], correctIndex: 2, explanation: 'E' }] }),
  'l3-content correctIndex 越界被 invariants 拒（跨字段）',
);
expectContractError('l3-content', '{"coreText":"x"}', 'l3-content 缺 exercises 被拒');

console.log('\nSELFCHECK OK');
```

- [ ] **Step 2: 跑自检确认失败**

```powershell
cd packages/prompt-manager
..\..\apps\api\node_modules\.bin\ts-node src/stages.selfcheck.ts
```
Expected: FAIL（stage 0 的 schema 尚未定义 → `PromptManager.parse` 内部报错）

- [ ] **Step 3: 建 `schemas/common.ts`**

```ts
import * as z from 'zod';

/** L1/L2 节点条目（stage 1 与 stage 2 共用同一形状） */
export const nodeItemSchema = z.object({
  title: z.string().min(1).max(60).meta({ description: '节点标题，5-15 字' }),
  description: z.string().min(1).max(200).meta({ description: '一句话描述' }),
});

export const outlineSchema = z.object({
  nodes: z.array(nodeItemSchema).min(1).max(20).meta({ description: '节点列表' }),
});
export type OutlineOutput = z.infer<typeof outlineSchema>;

export const codeExampleSchema = z.object({
  title: z.string().min(1).max(120).meta({ description: '示例标题' }),
  language: z.string().min(1).max(30).meta({ description: '代码语言，如 javascript/typescript/python/go' }),
  code: z.string().min(1).max(8000).meta({ description: '代码正文' }),
});
export type CodeExampleOutput = z.infer<typeof codeExampleSchema>;

export const exerciseSchema = z.object({
  question: z.string().min(1).max(500).meta({ description: '题干' }),
  options: z.array(z.string().min(1).max(300)).min(2).max(6).meta({ description: '选项，4 个为宜' }),
  correctIndex: z.number().int().min(0).max(5).meta({ description: '正确选项下标，从 0 开始' }),
  explanation: z.string().min(1).max(1000).meta({ description: '答案解析' }),
});
export type ExerciseOutput = z.infer<typeof exerciseSchema>;
```

- [ ] **Step 4: stage 0 加 schema**

`stage-0-knowledge-points.ts`：把 `parse: extractJson` 换成 `defineTemplate`，并加 schema：

```ts
import * as z from 'zod';
import { defineTemplate } from '../prompt-engine';

export interface KnowledgePointsInput {
  title: string;
  description?: string;
  type: string;
  keywords?: string;
}

export const knowledgePointsSchema = z.object({
  points: z.array(z.string().min(1).max(60)).min(1).max(30).meta({ description: '候选知识点列表' }),
});
export type KnowledgePointsOutput = z.infer<typeof knowledgePointsSchema>;

export const stage0KnowledgePoints = defineTemplate<KnowledgePointsInput, KnowledgePointsOutput>({
  version: '2.0.0',
  stage: 'knowledge-points',
  schema: knowledgePointsSchema,
  body: (input) => `
角色：你是一位资深的技术学习路径规划师。
任务：为一个技能方向拆解出具体、可学习的知识点清单。这些知识点将交给用户勾选，再被你归纳成 L1 学习大纲。

输入：
- 技能方向名称：${input.title}
- 描述：${input.description || '无'}
- 模式：${input.type === 'EXPERT' ? '进阶' : '入门'}
- 用户补充关键词：${input.keywords || '无'}

要求：
1. 输出 12-20 个知识点，覆盖该技能方向的核心子领域。
2. 每个知识点应是一个具体、独立的学习单元，字数控制在 4-12 字。
3. 粒度适中：既不要过宏观（如"基础"），也不要过细节（如某个具体函数的用法）。
4. 若用户提供了补充关键词，优先包含相关知识点，并保证其排序靠前。
5. 知识点之间允许有依赖关系，但不要重复。
`,
});
```

> **注意**：每个 stage 的 `body` 都要**删掉原来手写的「输出格式：{...}」段落**（格式段现在由 `outputFormatSection` 自动追加）；
> 同时删掉原有第 6 条「输出必须是合法 JSON…」（已由格式段统一表达）。角色/任务/输入/要求等正文一律保留。

- [ ] **Step 5: stage 1 / 2 加 schema（复用 `outlineSchema`）**

`stage-1-l1-outline.ts`：

```ts
import { defineTemplate } from '../prompt-engine';
import { outlineSchema, OutlineOutput } from '../schemas/common';

export interface L1OutlineInput {
  title: string;
  description?: string;
  type: string;
  selectedPoints?: string[];
}

export const stage1L1Outline = defineTemplate<L1OutlineInput, OutlineOutput>({
  version: '2.0.0',
  stage: 'l1-outline',
  schema: outlineSchema,
  body: (input) => {
    const pointsText = input.selectedPoints?.length
      ? `用户已勾选的知识点：\n${input.selectedPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n`
      : '';
    const modeText = input.type === 'EXPERT' ? '进阶' : input.type === 'INTERVIEW' ? '面试' : '入门';
    const modeHint =
      input.type === 'INTERVIEW'
        ? '\n5. 当前为面试模式：大纲应面向面试高频考点组织，侧重常被追问的核心概念、原理对比与实战经验。'
        : '';
    return `
角色：你是一位资深的技术学习路径规划师。
任务：为一个技能方向生成 L1（一级）学习大纲。L1 代表"学什么"，是最高层级的知识领域划分。

输入：
- 技能方向名称：${input.title}
- 描述：${input.description || '无'}
- 模式：${modeText}
${pointsText}
要求：
1. 输出 4-8 个 L1 节点，覆盖该技能方向的核心领域。
2. ${input.selectedPoints?.length ? '每个 L1 节点应基于用户勾选的知识点进行归纳分组，可以一个 L1 涵盖多个相关知识点。' : '每个节点包含 title（标题，5-15 字）和 description（一句话描述）。'}
3. 节点之间应逻辑清晰、互不重叠、循序渐进。${modeHint}
`;
  },
});
```

`stage-2-l2-nodes.ts`：

```ts
import { defineTemplate } from '../prompt-engine';
import { outlineSchema, OutlineOutput } from '../schemas/common';

export interface L2NodesInput {
  l1Title: string;
  l1Description: string;
  skillTreeName: string;
}

export const stage2L2Nodes = defineTemplate<L2NodesInput, OutlineOutput>({
  version: '2.0.0',
  stage: 'l2-nodes',
  schema: outlineSchema,
  body: (input) => `
角色：你是一位资深的技术学习路径规划师。
任务：为一个 L1 节点生成 L2（二级）学习主题。L2 代表"有什么内容"，是 L1 下的具体知识模块。

输入：
- 技能方向：${input.skillTreeName}
- L1 节点标题：${input.l1Title}
- L1 节点描述：${input.l1Description}

要求：
1. 输出 3-6 个 L2 节点，覆盖 L1 节点下的核心主题。
2. 每个节点包含 title（标题，5-20 字）和 description（一句话描述）。
3. 节点应具体、可学习，避免过于宏大或重复。
`,
});
```

- [ ] **Step 6: stage 3 加 schema 与跨字段不变量**

`stage-3-l3-content.ts`：

```ts
import * as z from 'zod';
import { defineTemplate } from '../prompt-engine';
import { codeExampleSchema, exerciseSchema } from '../schemas/common';

export interface L3ContentInput {
  l1Title: string;
  l2Title: string;
  skillTreeName: string;
}

export const l3ContentSchema = z.object({
  coreText: z.string().min(50).max(6000).meta({ description: '核心学习内容，Markdown 排版，300-800 字' }),
  codeExamples: z.array(codeExampleSchema).max(3).meta({ description: '代码示例，纯概念主题可为空数组' }),
  exercises: z.array(exerciseSchema).min(1).max(6).meta({ description: '单选题，4-6 道' }),
});
export type L3ContentOutput = z.infer<typeof l3ContentSchema>;

export const stage3L3Content = defineTemplate<L3ContentInput, L3ContentOutput>({
  version: '2.0.0',
  stage: 'l3-content',
  schema: l3ContentSchema,
  // JSON Schema 无法表达「correctIndex 必须落在 options 范围内」，故走 invariants
  invariants: (v) =>
    v.exercises
      .map((ex, i) =>
        ex.correctIndex >= ex.options.length
          ? `exercises[${i}].correctIndex=${ex.correctIndex} 超出 options 范围(0..${ex.options.length - 1})`
          : null,
      )
      .filter((m): m is string => !!m),
  body: (input) => `
角色：你是一位资深的技术内容作者和题库设计师。
任务：为一个 L2 节点生成 L3（三级）学习内容、可运行代码示例与练习题。L3 代表"具体学什么"，是可直接学习的知识点。

输入：
- 技能方向：${input.skillTreeName}
- L1 节点：${input.l1Title}
- L2 节点：${input.l2Title}

要求：
1. coreText：用中文撰写 300-800 字的核心学习内容，解释概念、用途、注意事项。
   - 必须使用 Markdown 格式排版，避免写成一整个长段落。
   - 使用二级标题（##）划分小节，例如：基本语法、使用场景、注意事项、常见误区等。
   - 使用列表（- 或 1.）展示并列点、步骤或示例。
   - 关键术语、代码片段、函数名等使用行内代码或加粗突出。
   - 每个段落控制在 3-5 句话以内，段落之间留出空行。
2. codeExamples：提供 1-3 个与知识点直接相关的可运行代码示例。若主题是纯概念性、不需要代码的，可返回空数组。
3. exercises：提供 4-6 道单选题，每题 4 个选项；correctIndex 必须落在 options 的下标范围内。
4. 内容应准确、实用、适合自学者。
`,
});
```

- [ ] **Step 7: 跑自检确认通过**

```powershell
cd packages/prompt-manager
..\..\apps\api\node_modules\.bin\ts-node src/stages.selfcheck.ts
..\..\node_modules\.bin\tsc -p tsconfig.json --noEmit
```
Expected: 全部 `PASS` + `SELFCHECK OK`；`tsc` 无错误

- [ ] **Step 8: 提交**

```powershell
node_modules\.bin\tsc -p packages/prompt-manager/tsconfig.json 2>&1 | Select-Object -First 10
git add packages/prompt-manager
git commit -m "✨ feat: 生成类 stage 契约（knowledge-points / l1-outline / l2-nodes / l3-content）"
```

---

## Task 4: 分析类与其余 stage 契约（4 / 5 / 6 / 7 / 8）

**Files:**
- Modify: `packages/prompt-manager/src/templates/stage-4-discover-new.ts`
- Modify: `packages/prompt-manager/src/templates/stage-5-check-expire.ts`
- Modify: `packages/prompt-manager/src/templates/stage-6-interview-qa.ts`
- Modify: `packages/prompt-manager/src/templates/stage-7-portrait.ts`
- Modify: `packages/prompt-manager/src/templates/stage-8-recommendations.ts`
- Modify: `packages/prompt-manager/src/stages.selfcheck.ts`

**Interfaces:**
- Produces：5 个 stage 的 `schema` / `invariants`；`StageOutput<'recommendations'>` 等

- [ ] **Step 1: 扩展自检（先红）**

在 `stages.selfcheck.ts` 末尾追加：

```ts
// stage 4
assert(
  PromptManager.parse(
    'discover-new',
    JSON.stringify({ suggestions: [{ parentTitle: 'L1', title: 'T', description: 'd', reason: 'r' }] }),
  ).suggestions.length === 1,
  'discover-new 正例',
);
assert(
  PromptManager.parse('discover-new', JSON.stringify({ suggestions: [{ parentTitle: null, title: 'T', description: 'd', reason: 'r' }] })).suggestions[0].parentTitle === null,
  'discover-new 允许 parentTitle=null（新增 L1）',
);
expectContractError('discover-new', '{"suggestions":[{"title":"T"}]}', 'discover-new 缺字段被拒');

// stage 5
assert(
  PromptManager.parse(
    'check-expire',
    JSON.stringify({ suggestions: [{ nodeTitle: 'N', expireLevel: 2, reason: 'r' }] }),
  ).suggestions[0].expireLevel === 2,
  'check-expire 正例',
);
expectContractError(
  'check-expire',
  JSON.stringify({ suggestions: [{ nodeTitle: 'N', expireLevel: 4, reason: 'r' }] }),
  'check-expire expireLevel 越界被拒',
);

// stage 6
assert(
  PromptManager.parse(
    'interview-qa',
    JSON.stringify({ questions: [{ question: 'Q', answer: 'A', difficulty: 'HARD' }] }),
  ).questions[0].difficulty === 'HARD',
  'interview-qa 正例',
);
expectContractError(
  'interview-qa',
  JSON.stringify({ questions: [{ question: 'Q', answer: 'A', difficulty: 'NIGHTMARE' }] }),
  'interview-qa difficulty 非枚举被拒',
);

// stage 7
assert(
  PromptManager.parse(
    'portrait',
    JSON.stringify({ summary: 's', identityTags: ['a'], interestTags: ['b'], goalTags: ['c'], learningStyle: 'hands-on' }),
  ).identityTags[0] === 'a',
  'portrait 正例',
);
expectContractError('portrait', '{"summary":"s"}', 'portrait 缺标签数组被拒');

// stage 8
assert(
  PromptManager.parse(
    'recommendations',
    JSON.stringify({
      recommendations: [
        { title: 'T', description: 'd', reason: 'r', matchTags: ['兴趣'], suggestedMode: 'ENTRY', keywords: ['k'] },
      ],
    }),
  ).recommendations[0].suggestedMode === 'ENTRY',
  'recommendations 正例',
);
expectContractError(
  'recommendations',
  JSON.stringify({ recommendations: [{ title: 'T', description: 'd', reason: 'r', matchTags: [], suggestedMode: 'WAT', keywords: [] }] }),
  'recommendations suggestedMode 非枚举被拒',
);
```

```powershell
cd packages/prompt-manager
..\..\apps\api\node_modules\.bin\ts-node src/stages.selfcheck.ts
```
Expected: FAIL（这 5 个 stage 的 schema 还没接上）

- [ ] **Step 2: stage 4 / 5**

```ts
// stage-4-discover-new.ts
import * as z from 'zod';
import { defineTemplate } from '../prompt-engine';

export interface DiscoverNewInput {
  treeName: string;
  treeType?: string;
  nodes: { level: number; title: string; description?: string; parentTitle?: string }[];
  existingSuggestions?: string[];
}

export const discoverNewSchema = z.object({
  suggestions: z
    .array(
      z.object({
        parentTitle: z
          .string()
          .min(1)
          .max(60)
          .nullable()
          .optional()
          .meta({ description: '建议挂载的 L1 标题，必须与现有 L1 逐字一致；新增 L1 时为 null' }),
        title: z.string().min(1).max(60).meta({ description: '主题名，5-15 字' }),
        description: z.string().min(1).max(300).meta({ description: '一句话描述' }),
        reason: z.string().min(1).max(300).meta({ description: '为什么值得补充' }),
      }),
    )
    .max(10)
    .meta({ description: '建议新增的节点列表' }),
});
export type DiscoverNewOutput = z.infer<typeof discoverNewSchema>;

export const stage4DiscoverNew = defineTemplate<DiscoverNewInput, DiscoverNewOutput>({
  version: '2.0.0',
  stage: 'discover-new',
  schema: discoverNewSchema,
  invariants: (v) =>
    v.suggestions.some((s) => s.parentTitle && s.parentTitle.trim().length === 0)
      ? ['parentTitle 不能是空字符串，新增 L1 时请用 null']
      : [],
  body: (input) => {
    const nodeList = input.nodes
      .map((n) => `${'  '.repeat(n.level - 1)}- [L${n.level}] ${n.title}${n.description ? '：' + n.description : ''}`)
      .join('\n');
    const existing = input.existingSuggestions?.length
      ? `\n以下主题已经建议过但尚未处理，不要重复建议（包括语义重复的换说法）：\n${input.existingSuggestions.map((t) => `- ${t}`).join('\n')}\n`
      : '';
    return `
角色：你是一位技术趋势观察者。
任务：审视一棵技能树的现有结构，找出缺失的重要学习主题。

输入：
- 技能树名称：${input.treeName}
- 模式：${input.treeType || 'ENTRY'}
- 现有节点：
${nodeList || '（暂无节点）'}
${existing}
要求：
1. 建议 1-5 个缺失的 L2 级学习主题；只有当现有 L1 完全无法容纳时，才建议新增 L1（parentTitle 为 null）。
2. 每条建议包含：parentTitle（建议挂载的 L1 标题，必须与上方现有 L1 标题逐字一致；新增 L1 时为 null）、title、description、reason。
`;
  },
});
```

```ts
// stage-5-check-expire.ts
import * as z from 'zod';
import { defineTemplate } from '../prompt-engine';

export interface CheckExpireInput {
  treeName: string;
  treeType?: string;
  nodes: { level: number; title: string; description?: string; parentTitle?: string }[];
  existingSuggestions?: string[];
}

export const checkExpireSchema = z.object({
  suggestions: z
    .array(
      z.object({
        nodeTitle: z.string().min(1).max(120).meta({ description: '要标记过期的节点标题，必须与现有节点逐字一致' }),
        expireLevel: z
          .number()
          .int()
          .min(1)
          .max(3)
          .meta({ description: '过期等级：1 轻微 / 2 明显 / 3 建议放弃' }),
        reason: z.string().min(1).max(300).meta({ description: '判断依据' }),
      }),
    )
    .max(20)
    .meta({ description: '建议标记过期的节点列表' }),
});
export type CheckExpireOutput = z.infer<typeof checkExpireSchema>;

export const stage5CheckExpire = defineTemplate<CheckExpireInput, CheckExpireOutput>({
  version: '2.0.0',
  stage: 'check-expire',
  schema: checkExpireSchema,
  body: (input) => {
    const nodeList = input.nodes
      .map((n) => `${'  '.repeat(n.level - 1)}- [L${n.level}] ${n.title}${n.description ? '：' + n.description : ''}`)
      .join('\n');
    const existing = input.existingSuggestions?.length
      ? `\n以下节点已经被标记过过期建议但尚未处理，不要重复提出：\n${input.existingSuggestions.map((t) => `- ${t}`).join('\n')}\n`
      : '';
    return `
角色：你是一位技术观察者。
任务：审视一棵技能树的现有节点，找出已经过时的内容。

输入：
- 技能树名称：${input.treeName}
- 现有节点：
${nodeList || '（暂无节点）'}
${existing}
过期等级定义：
- 1（轻微）：内容主体仍可用，但部分细节（版本、API、工具链）已有更新；
- 2（明显）：最佳实践已更替，继续按旧方式学习会走弯路；
- 3（建议放弃）：已被淘汰，不应再投入时间。

要求：nodeTitle 必须与上方现有节点标题逐字一致；只标记确有把握的节点，宁缺勿滥。
`;
  },
});
```

- [ ] **Step 3: stage 6 / 7 / 8**

```ts
// stage-6-interview-qa.ts
import * as z from 'zod';
import { defineTemplate } from '../prompt-engine';

export interface InterviewQAInput {
  treeName: string;
  l1Title: string;
  l2Title: string;
  l2Description?: string;
}

export const interviewQaSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1).max(500).meta({ description: '面试官会真实提出的问题' }),
        answer: z.string().min(1).max(1000).meta({ description: '要点式参考答案，200 字以内' }),
        difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).meta({ description: '难度' }),
      }),
    )
    .min(1)
    .max(8)
    .meta({ description: '面试题列表' }),
});
export type InterviewQAOutput = z.infer<typeof interviewQaSchema>;

export const stage6InterviewQA = defineTemplate<InterviewQAInput, InterviewQAOutput>({
  version: '3.0.0',
  stage: 'interview-qa',
  schema: interviewQaSchema,
  body: (input) => `
角色：你是一位资深技术面试官，擅长围绕单个知识点设计高质量的面试题。
任务：针对技能树「${input.treeName}」中的一个学习主题，生成一组面试 Q&A。

输入：
- 所属领域（L1）：${input.l1Title}
- 主题（L2）：${input.l2Title}${input.l2Description ? `：${input.l2Description}` : ''}

要求：
1. 围绕该 L2 主题出 3-5 道面试题，不得跑题到其他领域。
2. difficulty 三种难度混合（至少包含一道 EASY 和一道 MEDIUM 以上）。
3. question 具体、可回答，避免空泛。
4. answer 是要点式参考答案，200 字以内。
`,
});
```

```ts
// stage-7-portrait.ts
import * as z from 'zod';
import { defineTemplate } from '../prompt-engine';

export interface PortraitInput {
  identityAnswers: string[];
  interestAnswers: string[];
  goalAnswers: string[];
  backgroundAnswers: string[];
}

export const portraitSchema = z.object({
  summary: z.string().min(1).max(200).meta({ description: '50 字以内的用户状态概括' }),
  identityTags: z.array(z.string().min(1).max(30)).min(1).max(10).meta({ description: '身份标签 3-5 个' }),
  interestTags: z.array(z.string().min(1).max(30)).min(1).max(10).meta({ description: '兴趣标签 3-5 个' }),
  goalTags: z.array(z.string().min(1).max(30)).min(1).max(10).meta({ description: '目标标签 2-4 个' }),
  learningStyle: z.string().min(1).max(50).meta({ description: '学习偏好标签，如 hands-on / theory-first / video / reading' }),
});
export type PortraitOutput = z.infer<typeof portraitSchema>;

export const stage7Portrait = defineTemplate<PortraitInput, PortraitOutput>({
  version: '2.0.0',
  stage: 'portrait',
  schema: portraitSchema,
  body: (input) => `
角色：你是一位用户画像分析师。
任务：基于用户的问卷调查答案，生成用户肖像摘要。

输入：
- 身份信息：${input.identityAnswers.join('；')}
- 兴趣偏好：${input.interestAnswers.join('；')}
- 学习目标：${input.goalAnswers.join('；')}
- 背景信息：${input.backgroundAnswers.join('；')}
`,
});
```

```ts
// stage-8-recommendations.ts
import * as z from 'zod';
import { defineTemplate } from '../prompt-engine';

export interface RecommendationsInput {
  portrait: Record<string, unknown>;
  learningSkills: { name: string; type: string; description?: string }[];
  oldRecommendations: { title: string; reason: string }[];
}

export const recommendationsSchema = z.object({
  recommendations: z
    .array(
      z.object({
        title: z.string().min(1).max(60).meta({ description: '学习方向名称' }),
        description: z.string().min(1).max(200).meta({ description: '一句话描述' }),
        reason: z.string().min(1).max(300).meta({ description: '推荐理由，结合用户肖像的哪个维度' }),
        matchTags: z.array(z.string().min(1).max(20)).max(5).meta({ description: '匹配维度标签，如 兴趣/目标/身份' }),
        suggestedMode: z.enum(['ENTRY', 'EXPERT', 'INTERVIEW']).meta({ description: '建议从哪个模式开始' }),
        keywords: z.array(z.string().min(1).max(30)).max(10).meta({ description: '创建技能树时用于生成知识点的关键词' }),
      }),
    )
    .min(1)
    .max(15)
    .meta({ description: '推荐列表' }),
});
export type RecommendationsOutput = z.infer<typeof recommendationsSchema>;

export const stage8Recommendations = defineTemplate<RecommendationsInput, RecommendationsOutput>({
  version: '2.0.0',
  stage: 'recommendations',
  schema: recommendationsSchema,
  body: (input) => {
    const portrait = input.portrait ?? {};
    const fmt = (v: unknown) => (Array.isArray(v) ? v.join('、') : String(v ?? ''));
    return `
角色：你是一位个性化学习路径规划师。
任务：基于用户的肖像和当前学习情况，推荐最适合的 10 个学习方向。

输入：
- 用户肖像：
  概述：${fmt(portrait.summary)}
  身份标签：${fmt(portrait.identityTags)}
  兴趣标签：${fmt(portrait.interestTags)}
  目标标签：${fmt(portrait.goalTags)}
  学习风格：${fmt(portrait.learningStyle)}
- 正在学习的技能：${input.learningSkills.map((s) => `${s.name}(${s.type})`).join('、') || '（暂无）'}
- 上次推荐（可保留仍适合的）：${input.oldRecommendations.map((r) => r.title).join('、') || '（无）'}

要求：
1. 输出恰好 10 个推荐方向（不超过 10）。
2. 排除用户已经在学的方向。
3. 方向要有层次：基础与进阶搭配。
4. 每条都给出具体理由，并指明匹配了肖像的哪个维度。
`;
  },
});
```

- [ ] **Step 4: 跑自检 + 类型检查确认通过**

```powershell
cd packages/prompt-manager
..\..\apps\api\node_modules\.bin\ts-node src/stages.selfcheck.ts
..\..\node_modules\.bin\tsc -p tsconfig.json --noEmit
```
Expected: 全部 `PASS` + `SELFCHECK OK`

- [ ] **Step 5: 收口 —— 把 `PromptTemplate.schema` 从可选改为必填**

此时 9 个 stage 已全部经 `defineTemplate` 迁移完毕，可以收紧类型（T1 把它设为可选，只是为了
让 T1~T3 期间仍有未迁移的旧模板能编译）。

`packages/prompt-manager/src/prompt-engine.ts`：

```ts
export interface PromptTemplate<TInput, TOutput> {
  version: string;
  /** 契约唯一来源：既做运行时校验，又派生提示词里的格式说明 */
  schema: z.ZodType<TOutput>;
  build: (input: TInput) => string;
  parse: (raw: string) => TOutput;
}
```

`PromptManager.schemaOf` 保留可选判断并抛错（这样即使将来漏了 schema 也能立刻发现）：
```ts
  static schemaOf(stage: PromptStage): z.ZodType {
    const schema = PROMPT_TEMPLATES[stage].schema;
    if (!schema) {
      throw new Error(`stage ${stage} 缺少 schema 契约`);
    }
    return schema;
  }
```

验证：`..\..\node_modules\.bin\tsc -p tsconfig.json --noEmit` 通过（若有 stage 漏迁移，此处会报错）；
再跑 `cd ../../apps/api; node_modules\.bin\tsc --noEmit`。

- [ ] **Step 6: 提交**

```powershell
git add packages/prompt-manager
git commit -m "✨ feat: 分析类与其余 stage 契约（discover-new / check-expire / interview-qa / portrait / recommendations）"
```

---

## Task 5: provider 返回 token 用量（接口变更）

**Files:**
- Modify: `packages/ai-provider/src/ai-provider.interface.ts`
- Modify: `packages/ai-provider/src/providers/deepseek.provider.ts`
- Modify: `packages/ai-provider/src/providers/mock.provider.ts`
- Create: `packages/ai-provider/src/providers/deepseek.provider.spec.ts`（可选，见 Step 4）

**Interfaces:**
- Produces:
  ```ts
  export interface AIProviderResult {
    content: string;
    promptTokens?: number;
    completionTokens?: number;
    model?: string;
  }
  export interface IAIProvider { chat(prompt: string, options?: AIProviderOptions): Promise<AIProviderResult>; }
  ```

**理由**：`ai_generations` 的 `prompt_tokens` / `completion_tokens` 若永远为 null，成本统计就是空的；
DeepSeek（OpenAI 兼容）的响应里本就带 `usage`，取出来是一行代码的事。

- [ ] **Step 1: 写失败测试**

创建 `apps/api/src/modules/ai-integration/provider-contract.spec.ts`（放这里是因为 ai-provider 包没有 jest 配置）：

```ts
import { MockProvider } from '@skill/ai-provider';

describe('IAIProvider 契约', () => {
  it('chat 返回带 content 的结果对象（用量字段可选）', async () => {
    const provider = new MockProvider();
    const result = await provider.chat('L3 学习内容 请生成 coreText');

    expect(typeof result.content).toBe('string');
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.promptTokens === undefined || typeof result.promptTokens === 'number').toBe(true);
  });
});
```

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/ai-integration/provider-contract
```
Expected: FAIL —— `result.content` 为 undefined（当前返回的是字符串）

- [ ] **Step 2: 改接口与两个实现**

`packages/ai-provider/src/ai-provider.interface.ts`：

```ts
export interface AIProviderOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface AIProviderCallOptions {
  temperature?: number;
  maxTokens?: number;
}

/** 一次 AI 调用的结果：正文 + 可选用量（用量用于 ai_generations 的成本统计） */
export interface AIProviderResult {
  content: string;
  promptTokens?: number;
  completionTokens?: number;
  model?: string;
}

export interface IAIProvider {
  chat(prompt: string, options?: AIProviderCallOptions): Promise<AIProviderResult>;
}
```

`deepseek.provider.ts`：

```ts
  async chat(prompt: string, options?: AIProviderCallOptions): Promise<AIProviderResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Always return valid JSON matching the requested schema, without markdown formatting or explanations.' },
        { role: 'user', content: prompt },
      ],
      temperature: options?.temperature ?? 0.7,
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
      model: response.model ?? this.model,
    };
  }
```

`mock.provider.ts`：把 9 处 `return JSON.stringify(...)` 改为 `return { content: JSON.stringify(...) }`，
并把方法签名改为 `Promise<AIProviderResult>`。（`extractLine` 等辅助方法不变。）

- [ ] **Step 3: 重新构建 ai-provider 并跑测试**

```powershell
node_modules\.bin\tsc -p packages/ai-provider/tsconfig.json
cd apps/api; node_modules\.bin\jest --runInBand src/modules/ai-integration/provider-contract
```
Expected: PASS

- [ ] **Step 4: 全量类型检查（预期会暴露 ai-integration 的 10 处调用）**

```powershell
cd apps/api; node_modules\.bin\tsc --noEmit 2>&1 | Select-String "error TS" | Select-Object -First 10
```
Expected: **报错** —— `ai-integration.service.ts` 里 `const raw = await provider.chat(prompt)` 之后把它当字符串用。
这正是 Task 6 要改的地方；本 Task 先把它改成最小可用：

`ai-integration.service.ts` 里所有 `const raw = await provider.chat(...)` 改为：
```ts
const { content: raw } = await provider.chat(prompt);
```
（10 处，机械替换；Task 6 会把整段逻辑重写。）

- [ ] **Step 5: 全量测试 + 提交**

```powershell
cd apps/api
node_modules\.bin\tsc --noEmit
node_modules\.bin\jest --runInBand
```
Expected: `tsc` 通过；既有 spec 全绿（`ai-integration` 的调用方 mock 的是 `aiService`，不受影响）

```powershell
git add packages/ai-provider apps/api/src/modules/ai-integration
git commit -m "✨ feat: IAIProvider.chat 返回 token 用量（供 ai_generations 成本统计）"
```

---

## Task 6: `ai_generations` 审计 + 契约失败重试

**Files:**
- Create: `apps/api/src/modules/ai-integration/ai-generation.service.ts`
- Create: `apps/api/src/modules/ai-integration/ai-generation.service.spec.ts`
- Create: `apps/api/src/modules/ai-integration/ai-integration.service.spec.ts`
- Modify: `apps/api/src/modules/ai-integration/ai-integration.module.ts`
- Modify: `apps/api/src/modules/ai-integration/ai-integration.service.ts`
- Modify（传 `ctx`）：`skill-tree.service.ts`、`tree-node.service.ts`、`content.service.ts`、`interview.service.ts`、`analysis.service.ts`、`portrait-ai.service.ts`、`recommendation.service.ts`

**Interfaces:**
- Produces:
  - `AiCallContext { userId?: string; treeId?: string; nodeId?: string }`
  - `AiIntegrationService.generate<K extends PromptStage>(stage: K, input: StageInput<K>, ctx: AiCallContext, options?: { maxTokens?: number }): Promise<StageOutput<K>>`
  - 原有 10 个方法保留为薄封装（签名追加 `ctx`），**调用方只多传一个参数**

- [ ] **Step 1: 写审计服务测试（先红）**

创建 `apps/api/src/modules/ai-integration/ai-generation.service.spec.ts`：

```ts
import { AiGenerationService } from './ai-generation.service';
import { AiGenerationErrorKind } from '@skill/shared';

describe('AiGenerationService', () => {
  let service: AiGenerationService;
  let repo: { create: jest.Mock; save: jest.Mock };
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = 'deepseek';
    process.env.AI_MODEL = 'deepseek-v4-flash';
    repo = { create: jest.fn((v) => v), save: jest.fn(async (v) => v) };
    service = new AiGenerationService(repo as never);
  });

  afterEach(() => {
    process.env.AI_PROVIDER = originalEnv;
  });

  it('记录成功调用：parsedOk=true、无 errorKind、带耗时与用量', async () => {
    await service.record({
      stage: 'l3-content',
      promptVersion: '2.0.0',
      prompt: 'p',
      rawResponse: '{"a":1}',
      parsedOk: true,
      latencyMs: 1234,
      attempt: 1,
      promptTokens: 100,
      completionTokens: 200,
      ctx: { userId: 'u1', treeId: 't1', nodeId: 'n1' },
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'l3-content',
        promptVersion: '2.0.0',
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        parsedOk: true,
        latencyMs: 1234,
        attempt: 1,
        promptTokens: 100,
        completionTokens: 200,
        userId: 'u1',
        treeId: 't1',
        nodeId: 'n1',
      }),
    );
  });

  it('记录失败调用：parsedOk=false 且带 errorKind/detail', async () => {
    await service.record({
      stage: 'l3-content',
      promptVersion: '2.0.0',
      prompt: 'p',
      rawResponse: 'bad',
      parsedOk: false,
      errorKind: AiGenerationErrorKind.SCHEMA_MISMATCH,
      errorDetail: '/exercises/0/correctIndex: too big',
      latencyMs: 10,
      attempt: 2,
      ctx: {},
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedOk: false,
        errorKind: AiGenerationErrorKind.SCHEMA_MISMATCH,
        errorDetail: '/exercises/0/correctIndex: too big',
        attempt: 2,
      }),
    );
  });

  it('审计写入失败不抛错（绝不影响业务调用）', async () => {
    repo.save.mockRejectedValue(new Error('DB down'));

    await expect(
      service.record({
        stage: 'portrait',
        promptVersion: '2.0.0',
        prompt: 'p',
        rawResponse: '{}',
        parsedOk: true,
        latencyMs: 1,
        attempt: 1,
        ctx: {},
      }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/ai-integration/ai-generation
```
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现审计服务**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import { AiGenerationErrorKind } from '@skill/shared';
import { AiGeneration } from './entities/ai-generation.entity';

export interface AiCallContext {
  userId?: string;
  treeId?: string;
  nodeId?: string;
}

export interface AiGenerationRecord {
  stage: string;
  promptVersion: string;
  prompt: string;
  rawResponse: string;
  parsedOk: boolean;
  latencyMs: number;
  attempt: number;
  errorKind?: AiGenerationErrorKind;
  errorDetail?: string;
  promptTokens?: number;
  completionTokens?: number;
  model?: string;
  ctx: AiCallContext;
}

/**
 * AI 调用审计。写入失败只记日志，绝不向上抛 —— 审计是旁路，不能影响业务主流程。
 */
@Injectable()
export class AiGenerationService {
  private readonly logger = new Logger(AiGenerationService.name);

  constructor(
    @InjectRepository(AiGeneration)
    private readonly repo: Repository<AiGeneration>,
  ) {}

  async record(entry: AiGenerationRecord): Promise<void> {
    try {
      await this.repo.save(
        this.repo.create({
          stage: entry.stage,
          promptVersion: entry.promptVersion,
          provider: process.env.AI_PROVIDER || 'mock',
          model: entry.model || process.env.AI_MODEL || 'unknown',
          userId: entry.ctx.userId ?? null,
          treeId: entry.ctx.treeId ?? null,
          nodeId: entry.ctx.nodeId ?? null,
          requestHash: createHash('sha1').update(entry.prompt).digest('hex').slice(0, 40),
          rawResponse: entry.rawResponse,
          parsedOk: entry.parsedOk,
          errorKind: entry.errorKind ?? null,
          errorDetail: entry.errorDetail ?? null,
          promptTokens: entry.promptTokens ?? null,
          completionTokens: entry.completionTokens ?? null,
          latencyMs: entry.latencyMs,
          attempt: entry.attempt,
        }),
      );
    } catch (err) {
      this.logger.warn(`AI 审计写入失败（已忽略）: ${err}`);
    }
  }
}
```

`ai-integration.module.ts`：`TypeOrmModule.forFeature([AiGeneration])`，并把 `AiGenerationService` 加入 `providers` / `exports`。

- [ ] **Step 4: 跑测试确认通过**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/ai-integration/ai-generation
```
Expected: PASS（3 用例）

- [ ] **Step 5: 写 ai-integration 的重试与审计测试（先红）**

创建 `apps/api/src/modules/ai-integration/ai-integration.service.spec.ts`：

```ts
import { ConfigService } from '@nestjs/config';
import { AiContractError } from '@skill/prompt-manager';
import { AiIntegrationService } from './ai-integration.service';

describe('AiIntegrationService（契约失败重试 + 审计）', () => {
  let service: AiIntegrationService;
  let provider: { chat: jest.Mock };
  let audit: { record: jest.Mock };
  let config: ConfigService;

  const goodPoints = JSON.stringify({ points: ['a', 'b'] });
  const badPoints = JSON.stringify({ points: 'not-an-array' });

  beforeEach(() => {
    provider = { chat: jest.fn() };
    audit = { record: jest.fn(async () => undefined) };
    config = { get: jest.fn((k: string) => ({ AI_PROVIDER: 'deepseek', AI_MODEL: 'm' }[k])) } as never;
    service = new AiIntegrationService(config, audit as never);
    jest.spyOn(service, 'getProvider').mockResolvedValue(provider as never);
  });

  it('形状正确时一次成功，落一条 parsedOk=true 的审计', async () => {
    provider.chat.mockResolvedValue({ content: goodPoints, promptTokens: 10, completionTokens: 20 });

    const result = await service.generate('knowledge-points', { title: 'T', type: 'ENTRY' }, { userId: 'u1' });

    expect(result.points).toEqual(['a', 'b']);
    expect(provider.chat).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ parsedOk: true, attempt: 1, stage: 'knowledge-points' }));
  });

  it('第一次形状错误 → 带 issues 反馈重试一次 → 第二次成功', async () => {
    provider.chat
      .mockResolvedValueOnce({ content: badPoints })
      .mockResolvedValueOnce({ content: goodPoints });

    const result = await service.generate('knowledge-points', { title: 'T', type: 'ENTRY' }, {});

    expect(result.points).toHaveLength(2);
    expect(provider.chat).toHaveBeenCalledTimes(2);
    // 第二次调用的提示词包含第一次的错误反馈
    const secondPrompt = provider.chat.mock.calls[1][0] as string;
    expect(secondPrompt).toContain('上一次');
    // 两次调用各落一条审计
    expect(audit.record).toHaveBeenCalledTimes(2);
    expect(audit.record.mock.calls[0][0]).toMatchObject({ parsedOk: false, attempt: 1 });
    expect(audit.record.mock.calls[1][0]).toMatchObject({ parsedOk: true, attempt: 2 });
  });

  it('两次都失败 → 抛 AiContractError，且审计两条均 parsedOk=false', async () => {
    provider.chat.mockResolvedValue({ content: badPoints });

    await expect(
      service.generate('knowledge-points', { title: 'T', type: 'ENTRY' }, {}),
    ).rejects.toBeInstanceOf(AiContractError);

    expect(provider.chat).toHaveBeenCalledTimes(2);
    expect(audit.record).toHaveBeenCalledTimes(2);
    expect(audit.record.mock.calls.every((c) => c[0].parsedOk === false)).toBe(true);
  });

  it('provider 抛错（网络/超时）→ 不重试，落一条 provider_error 审计后向上抛', async () => {
    provider.chat.mockRejectedValue(new Error('ECONNRESET'));

    await expect(
      service.generate('knowledge-points', { title: 'T', type: 'ENTRY' }, {}),
    ).rejects.toThrow('ECONNRESET');

    expect(provider.chat).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ parsedOk: false, errorKind: 'provider_error' }),
    );
  });
});
```

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/ai-integration/ai-integration.service
```
Expected: FAIL —— 构造函数签名与 `generate` 尚不存在

- [ ] **Step 6: 重写 `ai-integration.service.ts`**

要点（完整实现）：

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProviderFactory, IAIProvider, AIProviderResult } from '@skill/ai-provider';
import {
  AiContractError,
  PromptManager,
  PromptStage,
  StageInput,
  StageOutput,
} from '@skill/prompt-manager';
import { AIProviderConfig, AIProviderType, AiGenerationErrorKind } from '@skill/shared';
import { AiCallContext, AiGenerationService } from './ai-generation.service';

const MAX_ATTEMPTS = 2;

/** stage 4（discover-new）与 stage 5（check-expire）共用的入参形状 */
export interface DiscoveryNodeInput {
  treeName: string;
  treeType?: string;
  nodes: { level: number; title: string; description?: string; parentTitle?: string }[];
  existingSuggestions?: string[];
}

@Injectable()
export class AiIntegrationService {
  constructor(
    private readonly configService: ConfigService,
    private readonly audit: AiGenerationService,
  ) {}

  async getProvider(): Promise<IAIProvider> {
    const providerConfig: AIProviderConfig = {
      provider: (this.configService.get<string>('AI_PROVIDER') as AIProviderType) || AIProviderType.MOCK,
      apiKey: this.configService.get<string>('AI_API_KEY') || '',
      model: this.configService.get<string>('AI_MODEL') || 'deepseek-chat',
      baseUrl: this.configService.get<string>('AI_BASE_URL'),
    };
    return AIProviderFactory.create(providerConfig.provider, providerConfig);
  }

  private l3MaxTokens(): number {
    const raw = this.configService.get<string>('AI_L3_MAX_TOKENS');
    return raw ? parseInt(raw, 10) || 4096 : 4096;
  }

  /**
   * 唯一的 AI 调用入口：调用 → 审计 → 契约校验 → 失败带反馈重试一次。
   * 契约不通过时绝不返回半成品，由调用方决定如何处理（抛给前端 / 标记产物失败）。
   */
  async generate<K extends PromptStage>(
    stage: K,
    input: StageInput<K>,
    ctx: AiCallContext,
    options?: { maxTokens?: number },
  ): Promise<StageOutput<K>> {
    const provider = await this.getProvider();
    const basePrompt = PromptManager.build(stage, input);
    const promptVersion = PromptManager.versionOf(stage);

    let prompt = basePrompt;
    let lastError: AiContractError | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const startedAt = Date.now();
      let result: AIProviderResult;
      try {
        result = await provider.chat(prompt, {
          maxTokens: options?.maxTokens,
          temperature: attempt === 1 ? 0.7 : 0.3,
        });
      } catch (err) {
        await this.audit.record({
          stage,
          promptVersion,
          prompt,
          rawResponse: '',
          parsedOk: false,
          errorKind: AiGenerationErrorKind.PROVIDER_ERROR,
          errorDetail: err instanceof Error ? err.message : String(err),
          latencyMs: Date.now() - startedAt,
          attempt,
          ctx,
        });
        throw err;
      }

      const latencyMs = Date.now() - startedAt;
      try {
        const parsed = PromptManager.parse(stage, result.content);
        await this.audit.record({
          stage, promptVersion, prompt,
          rawResponse: result.content, parsedOk: true,
          latencyMs, attempt, ctx,
          promptTokens: result.promptTokens, completionTokens: result.completionTokens, model: result.model,
        });
        return parsed;
      } catch (err) {
        const contractError = err instanceof AiContractError
          ? err
          : new AiContractError(String(err), stage, 'schema_mismatch', result.content, []);
        lastError = contractError;
        await this.audit.record({
          stage, promptVersion, prompt,
          rawResponse: result.content, parsedOk: false,
          errorKind: this.errorKindOf(contractError),
          errorDetail: contractError.issues.map((i) => `${i.path}: ${i.message}`).join('; ').slice(0, 1000),
          latencyMs, attempt, ctx,
          promptTokens: result.promptTokens, completionTokens: result.completionTokens, model: result.model,
        });

        if (attempt < MAX_ATTEMPTS) {
          prompt = `${basePrompt}\n\n上一次的返回不符合约定，请修正以下问题后重新输出完整 JSON：\n${contractError.issues
            .map((i) => `- ${i.path}: ${i.message}`)
            .join('\n')}\n`;
        }
      }
    }

    throw lastError ?? new AiContractError('AI 输出不符合约定', stage, 'schema_mismatch', '');
  }

  private errorKindOf(err: AiContractError): AiGenerationErrorKind {
    switch (err.kind) {
      case 'invalid_json':
        return AiGenerationErrorKind.INVALID_JSON;
      case 'truncated':
        return AiGenerationErrorKind.TRUNCATED;
      default:
        return AiGenerationErrorKind.SCHEMA_MISMATCH;
    }
  }

  // ── 以下 10 个方法收窄为薄封装，签名在末尾追加 ctx ──────────────────

  async generateKnowledgePoints(input: { title: string; description?: string; type: TreeType; keywords?: string }, ctx: AiCallContext = {}) {
    return this.generate('knowledge-points', input, ctx);
  }

  async generateL1(title: string, description: string | undefined, type: TreeType, ctx: AiCallContext = {}) {
    return this.generate('l1-outline', { title, description, type }, ctx);
  }

  async generateL1FromPoints(title: string, description: string | undefined, type: TreeType, selectedPoints: string[], ctx: AiCallContext = {}) {
    return this.generate('l1-outline', { title, description, type, selectedPoints }, ctx);
  }

  async generateL2(l1Title: string, l1Description: string, skillTreeName: string, ctx: AiCallContext = {}) {
    return this.generate('l2-nodes', { l1Title, l1Description, skillTreeName }, ctx);
  }

  async generateL3(l1Title: string, l2Title: string, skillTreeName: string, ctx: AiCallContext = {}) {
    return this.generate('l3-content', { l1Title, l2Title, skillTreeName }, ctx, { maxTokens: this.l3MaxTokens() });
  }

  async generateInterviewQA(input: { treeName: string; l1Title: string; l2Title: string; l2Description?: string }, ctx: AiCallContext = {}) {
    return this.generate('interview-qa', input, ctx);
  }

  async generatePortrait(input: { identityAnswers: string[]; interestAnswers: string[]; goalAnswers: string[]; backgroundAnswers: string[] }, ctx: AiCallContext = {}) {
    return this.generate('portrait', input, ctx);
  }

  async generateDiscoverNew(input: DiscoveryNodeInput, ctx: AiCallContext = {}) {
    return this.generate('discover-new', input, ctx);
  }

  async generateCheckExpire(input: DiscoveryNodeInput, ctx: AiCallContext = {}) {
    return this.generate('check-expire', input, ctx);
  }

  async generateRecommendations(
    input: {
      portrait: Record<string, unknown>;
      learningSkills: { name: string; type: string; description?: string }[];
      oldRecommendations: { title: string; reason: string }[];
    },
    ctx: AiCallContext = {},
  ) {
    return this.generate('recommendations', input, ctx);
  }
    return this.generate('recommendations', input, ctx);
  }
}
```

> `ctx` 默认 `{}`：既强制调用方能传就传，又不让 8 个调用点在同一次改动里全部爆炸。
> 但**调用方必须传**（见 Step 8），默认值只是为了让改动可分批。

- [ ] **Step 7: 跑 ai-integration 测试确认通过**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/ai-integration
```
Expected: PASS（审计 3 + 重试 4 + provider-contract 1 + extract-json 原有）

- [ ] **Step 8: 8 个调用方传 `ctx`**

逐处改动（每处都是「末尾多传一个参数」）：

| 文件 | 调用 | 传入的 ctx |
|---|---|---|
| `skill-tree.service.ts` `create` | `generateL1FromPoints` / `generateL1` | `{ userId }`（此时树还没建，treeId 留空） |
| `skill-tree.service.ts` `generateKnowledgePoints` | `aiService.generateKnowledgePoints` | `{ userId }`（方法需加 userId 参数，见下） |
| `tree-node.service.ts` `expand` | `generateL2` | `{ userId, treeId: node.treeId, nodeId: node.id }` |
| `content.service.ts` `generateContent` | `generateL3` | `{ userId, treeId: node.treeId, nodeId: node.id }` |
| `interview.service.ts` `generateForNode` | `generateInterviewQA` | `{ userId, treeId, nodeId: node.id }`（`generateForNode` 需加 `userId` 形参，由 `findForTree` 透传） |
| `analysis.service.ts` `runAnalysis` | `generateDiscoverNew` / `generateCheckExpire` | `{ userId, treeId }` |
| `portrait-ai.service.ts` `generatePortrait` | `generatePortrait` | `{ userId }` |
| `recommendation.service.ts` `generateForUser` | `generateRecommendations` | `{ userId }` |

`skill-tree.service.generateKnowledgePoints` 与 `skill-tree.controller` 对应端点需加 `userId`：
```ts
  async generateKnowledgePoints(
    data: { title: string; description?: string; type: TreeType; keywords?: string },
    userId: string,
  ): Promise<{ points: string[] }> {
    return this.aiService.generateKnowledgePoints(
      {
        title: data.title,
        description: data.description,
        type: data.type,
        keywords: data.keywords,
      },
      { userId },
    );
  }
```
controller：`@Post('knowledge-points')` 加 `@Request() req` 并透传 `req.user.userId`。

- [ ] **Step 9: 全量回归 + 提交**

```powershell
cd apps/api
node_modules\.bin\tsc --noEmit
node_modules\.bin\jest --runInBand
```
Expected: 全绿

```powershell
git add apps/api
git commit -m "✨ feat: AI 调用统一入口（契约校验 + 带反馈重试 + ai_generations 审计）"
```

---

## Task 7: compute-then-write 事务（三处写路径）

**Files:**
- Create: `apps/api/src/modules/content/content.service.transaction.spec.ts`
- Modify: `apps/api/src/modules/skill-tree/skill-tree.service.ts`
- Modify: `apps/api/src/modules/content/content.service.ts`
- Modify: `apps/api/src/modules/portrait/portrait-ai.service.ts`
- Modify: 对应 3 个 module（注入 `DataSource` 无需改 module，`DataSource` 由 TypeOrmModule 全局提供）

**Interfaces:**
- Produces：三处写路径均为「AI 调用在事务外 → 单事务落库」；**AI 失败时事务绝不被开启**

- [ ] **Step 1: 写不变量测试（先红）**

创建 `apps/api/src/modules/content/content.service.transaction.spec.ts`：

```ts
import { ContentService } from './content.service';
import { NodeLevel } from '@skill/shared';

describe('ContentService（先算后落库）', () => {
  let service: ContentService;
  let contentRepo: { findOne: jest.Mock; create: jest.Mock };
  let exerciseRepo: { create: jest.Mock };
  let codeExampleRepo: { create: jest.Mock };
  let nodeRepo: { findOne: jest.Mock };
  let treeRepo: { findOne: jest.Mock };
  let aiService: { generateL3: jest.Mock };
  let treeAccess: { assertNodeOwner: jest.Mock };
  let manager: {
    getRepository: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };

  const node = { id: 'n1', treeId: 't1', parentId: 'l1', level: NodeLevel.L2, title: 'L2', description: 'd' };

  beforeEach(() => {
    contentRepo = { findOne: jest.fn(async () => null), create: jest.fn((v) => v) };
    exerciseRepo = { create: jest.fn((v) => v) };
    codeExampleRepo = { create: jest.fn((v) => v) };
    nodeRepo = { findOne: jest.fn(async () => ({ id: 'l1', title: 'L1' })) };
    treeRepo = { findOne: jest.fn(async () => ({ id: 't1', name: 'Tree' })) };
    aiService = { generateL3: jest.fn() };
    treeAccess = { assertNodeOwner: jest.fn(async () => node) };

    const txContent = { create: jest.fn((v) => v), save: jest.fn(async (v) => ({ ...v, id: 'c1' })) };
    const txCode = { create: jest.fn((v) => v), save: jest.fn(async (v) => v) };
    const txExercise = { create: jest.fn((v) => v), save: jest.fn(async (v) => v) };
    manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === (require('./entities/node-content.entity').NodeContent)) return txContent;
        if (entity === (require('./entities/code-example.entity').CodeExample)) return txCode;
        if (entity === (require('./entities/exercise.entity').Exercise)) return txExercise;
        throw new Error('unexpected entity');
      }),
    };
    dataSource = { transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) => cb(manager)) };

    service = new ContentService(
      contentRepo as never,
      exerciseRepo as never,
      codeExampleRepo as never,
      nodeRepo as never,
      treeRepo as never,
      aiService as never,
      treeAccess as never,
      dataSource as never,
    );
  });

  it('AI 失败时绝不开启事务（关键不变量：不留半成品）', async () => {
    aiService.generateL3.mockRejectedValue(new Error('AI down'));

    await expect(service.generateContent('n1', 'u1')).rejects.toThrow();

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(contentRepo.create).not.toHaveBeenCalled();
  });

  it('AI 成功后在一个事务里写入内容/代码示例/练习', async () => {
    aiService.generateL3.mockResolvedValue({
      coreText: '正文',
      codeExamples: [{ title: 't', language: 'ts', code: 'c' }],
      exercises: [{ question: 'Q', options: ['a', 'b'], correctIndex: 0, explanation: 'E' }],
    });

    await service.generateContent('n1', 'u1');

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.getRepository).toHaveBeenCalled();
  });
});
```

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/content/content.service.transaction
```
Expected: FAIL —— 构造函数第 8 个参数不存在、且未使用事务

- [ ] **Step 2: `content.service.ts` 改造**

构造加 `private dataSource: DataSource`；`generateContent` 改为：

```ts
  async generateContent(nodeId: string, userId: string): Promise<NodeContent> {
    const node = await this.treeAccess.assertNodeOwner(nodeId, userId);

    const existing = await this.loadContent(nodeId);
    if (existing) {
      return existing;
    }

    const l1Node = await this.nodeRepo.findOne({ where: { id: node.parentId } });
    const tree = await this.treeRepo.findOne({ where: { id: node.treeId } });

    // ① AI 调用在事务外（可重试、可审计，且不长时间占用连接）
    const result = await this.aiService.generateL3(
      l1Node?.title || '',
      node.title,
      tree?.name || '',
      { userId, treeId: node.treeId, nodeId },
    );

    // ② 校验通过的 payload → 一个短事务写全部
    await this.dataSource.transaction(async (manager) => {
      const contentRepo = manager.getRepository(NodeContent);
      const codeExampleRepo = manager.getRepository(CodeExample);
      const exerciseRepo = manager.getRepository(Exercise);

      const saved = await contentRepo.save(
        contentRepo.create({ nodeId, coreText: result.coreText, version: 1 }),
      );

      if (result.codeExamples.length > 0) {
        await codeExampleRepo.save(
          result.codeExamples.map((item, index) =>
            codeExampleRepo.create({
              nodeContentId: saved.id,
              title: item.title,
              language: item.language,
              code: item.code,
              sortOrder: index,
            }),
          ),
        );
      }

      if (result.exercises.length > 0) {
        await exerciseRepo.save(
          result.exercises.map((ex, index) =>
            exerciseRepo.create({
              nodeContentId: saved.id,
              question: ex.question,
              options: ex.options,
              correctIndex: ex.correctIndex,
              explanation: ex.explanation,
              sortOrder: index,
            }),
          ),
        );
      }
    });

    return (await this.loadContent(nodeId)) as NodeContent;
  }
```

> 注意：契约已保证 `result.codeExamples` / `result.exercises` 是数组，故原来的 `|| []` 守卫可以去掉；
> 保留也不会错，但**本计划选择去掉**（契约是唯一真相，多余守卫会掩盖契约失效）。

- [ ] **Step 3: `skill-tree.service.ts` 改造**

`create` 改为：AI 在事务外 → 单事务写 树 + L1 节点 + 学习记录。
注意关键变化：**AI 调用不再需要先落库拿树 id**（树名/描述/模式都来自入参），
所以「AI 失败留下孤儿树」这条路被彻底堵死。

```ts
  async create(
    data: { name: string; description?: string; type: TreeType; selectedPoints?: string[]; keywords?: string },
    userId: string,
  ): Promise<SkillTree> {
    // ① 先算（事务外，可重试、可审计）
    const l1Result = data.selectedPoints?.length
      ? await this.aiService.generateL1FromPoints(
          data.name,
          data.description,
          data.type,
          data.selectedPoints,
          { userId },
        )
      : await this.aiService.generateL1(data.name, data.description, data.type, { userId });
```

```ts
    // ② 后落库（单事务）
    const treeId = await this.dataSource.transaction(async (manager) => {
      const treeRepo = manager.getRepository(SkillTree);
      const nodeRepo = manager.getRepository(TreeNode);
      const recordRepo = manager.getRepository(LearningRecord);

      const tree = await treeRepo.save(
        treeRepo.create({
          name: data.name, description: data.description, type: data.type,
          keywords: data.keywords, status: 'ACTIVE', ownerId: userId,
        }),
      );

      if (l1Result.nodes.length > 0) {
        await nodeRepo.save(
          l1Result.nodes.map((n, index) =>
            nodeRepo.create({
              treeId: tree.id, level: NodeLevel.L1,
              title: n.title, description: n.description, sortOrder: index,
            }),
          ),
        );
      }

      await recordRepo.save(
        recordRepo.create({ userId, skillTreeId: tree.id, status: LearningStatus.IN_PROGRESS }),
      );

      return tree.id;
    });

    return this.findById(treeId, userId);
  }
```

**对应的测试更新**：`skill-tree.service.spec.ts` 的 `beforeEach` 需加 `dataSource` mock（`transaction` 调用回调并传入带 `getRepository` 的 manager，manager 返回与现有 treeRepo/nodeRepo/recordRepo 相同的 mock 对象），并新增一条：

```ts
  it('AI 失败时不写任何数据（事务未开启）', async () => {
    aiService.generateL1.mockRejectedValue(new Error('AI down'));

    await expect(
      service.create({ name: 'X', type: TreeType.ENTRY }, 'user-1'),
    ).rejects.toThrow();

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
```

- [ ] **Step 4: `portrait-ai.service.ts` 改造**

```ts
  async generatePortrait(userId: string, answers: { questionId: string; selectedOptions: string[] }[]) {
    const questions = await this.questionService.findByIds(answers.map((a) => a.questionId));

    // ① 先算（此时不动数据库：答案与画像要么一起更新，要么都不动）
    const grouped: Record<PortraitQuestionCategory, string[]> = {
      [PortraitQuestionCategory.IDENTITY]: [],
      [PortraitQuestionCategory.INTEREST]: [],
      [PortraitQuestionCategory.GOAL]: [],
      [PortraitQuestionCategory.BACKGROUND]: [],
    };

    for (const answer of answers) {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) continue;
      const selectedText = answer.selectedOptions.map(
        (opt) => question.options.find((o) => o === opt) || opt,
      );
      grouped[question.category].push(`${question.question}: ${selectedText.join(', ')}`);
    }

    const portrait = await this.aiService.generatePortrait(
      {
        identityAnswers: grouped[PortraitQuestionCategory.IDENTITY],
        interestAnswers: grouped[PortraitQuestionCategory.INTEREST],
        goalAnswers: grouped[PortraitQuestionCategory.GOAL],
        backgroundAnswers: grouped[PortraitQuestionCategory.BACKGROUND],
      },
      { userId },
    );

    // ② 单事务：替换答案 + 更新画像
    await this.dataSource.transaction(async (manager) => {
      const profile = await this.userService.getProfile(userId);
      if (!profile) return;

      const answerRepo = manager.getRepository(PortraitAnswer);
      await answerRepo.delete({ profileId: profile.id });
      await answerRepo.save(
        answers.map((a) =>
          answerRepo.create({ profileId: profile.id, questionId: a.questionId, selectedOptions: a.selectedOptions }),
        ),
      );

      await manager.getRepository(UserProfile).update(
        { userId },
        { computedPortrait: portrait, portraitUpdatedAt: new Date(), portraitSchemaVersion: '2.0.0' },
      );
    });

    return portrait;
  }
```

`schemaVersion` 用 `PromptManager.versionOf('portrait')` 而不是硬编码。

- [ ] **Step 5: 跑全部测试**

```powershell
cd apps/api
node_modules\.bin\jest --runInBand
node_modules\.bin\tsc --noEmit
```
Expected: 全绿（含新增的两条「事务未开启」不变量）

- [ ] **Step 6: 提交**

```powershell
git add apps/api
git commit -m "🐛 fix: 三处写路径改为先算后落库（AI 在事务外，单事务写入，根治半成品数据）"
```

---

## Task 8: 真实 AI 端到端验证 + 阶段 3 收尾

**Files:**
- Create: `docs/plans/2026-09-16-phase3-verification.md`

**Interfaces:**
- Consumes: 前 7 个 Task 的全部产出
- Produces: 阶段 3 的验收证据

- [ ] **Step 1: 全量回归**

```powershell
cd apps/api
node_modules\.bin\tsc --noEmit
node_modules\.bin\jest --runInBand
node_modules\.bin\ts-node scripts/verify-schema.ts
cd ../../packages/prompt-manager
..\..\apps\api\node_modules\.bin\ts-node src/prompt-engine.selfcheck.ts
..\..\apps\api\node_modules\.bin\ts-node src/prompt-manager.selfcheck.ts
..\..\apps\api\node_modules\.bin\ts-node src/stages.selfcheck.ts
```
Expected: `tsc` 0；jest 全绿；`SCHEMA OK`；三个 `SELFCHECK OK`

- [ ] **Step 2: 真实 AI 端到端（写入审计表）**

启动服务并用两个账号验证（脚本临时创建、验证后删除）：

```powershell
cd apps/api
$p = Start-Process -FilePath "node_modules\.bin\nest.cmd" -ArgumentList "start" -WorkingDirectory (Get-Location) -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\p3-out.log" -RedirectStandardError "$env:TEMP\p3-err.log"
for ($i = 0; $i -lt 40; $i++) { Start-Sleep -Seconds 3; if ((Get-Content "$env:TEMP\p3-out.log" -ErrorAction SilentlyContinue | Select-String -Pattern "API running on" -Quiet) -or $p.HasExited) { break } }
```

验证清单（逐条记录结果到 `docs/plans/2026-09-16-phase3-verification.md`）：

| # | 操作 | 期望 |
|---|---|---|
| 1 | 注册 A，`POST /skill-trees`（真实 AI 生成 L1） | 200；`tree_nodes` 里有 4-8 个 L1；**`ai_generations` 恰有 1 行 parsed_ok=true、stage=`l1-outline`、prompt_version=`2.0.0`** |
| 2 | 检查该行的 `latency_ms > 0`、`request_hash` 非空 | 通过 |
| 3 | `POST /portrait/submit`（真实 AI 生成画像） | 200；`user_profiles.computed_portrait` 形状完整；`portrait_schema_version = '2.0.0'`；`ai_generations` 多一行 stage=`portrait` |
| 4 | `POST /nodes/:l1/expand`（真实 AI 生成 L2） | 200；L2 落库；`ai_generations` 多一行 stage=`l2-nodes` |
| 5 | `POST /nodes/:l2/content`（真实 AI 生成 L3） | 200；`node_contents` + `code_examples` + `exercises` **三张表同时有数据**（证明单事务生效）；`ai_generations` 多一行 stage=`l3-content` |
| 6 | 对同一条日志查 `prompt_tokens` / `completion_tokens` | 若非空则记录实际值（Task 5 的收益）；若为 null 记录原因 |
| 7 | 汇总：`select stage, count(*), bool_and(parsed_ok) from ai_generations group by 1` | 每个 stage 的调用次数与成功率 |
| 8 | 清理：删除 E2E 用户（经级联清掉全部数据） | 用户/树/节点残留为 0 |
| 9 | 保留 `ai_generations` 里的记录作为审计样例（不随用户删除而消失，因其 FK 是 SET NULL） | **验证 SET NULL 行为**：`ai_generations` 行仍在，`user_id/tree_id/node_id` 已置 null |

最后一条是个有价值的额外验证：它证明审计记录的生命周期独立于业务数据。

- [ ] **Step 3: 写验证文档**

创建 `docs/plans/2026-09-16-phase3-verification.md`，内容结构参照 `2026-09-16-phase1-2-verification.md`：
验证矩阵、端到端 9 项结果、执行偏差、遗留事项（交给阶段 4：产物状态机 / stage-3 拆分 / 前端分块）。

- [ ] **Step 4: 阶段 3 收尾提交**

```powershell
git add docs/plans
git commit -m "📃 docs: 阶段 3 验证记录（契约层 + 审计 + 先算后落库）"
```

---

## Self-Review 结果

**规格覆盖（对照设计文档第 3 节）**

| 设计条目 | 覆盖任务 |
|---|---|
| 3.1 结构：契约与模板同居 | Task 1（`prompt-engine` + `schemas/common` + 各 stage 文件） |
| 3.2 接口收敛、消灭 9 份样板 | Task 1（`defineTemplate`）+ Task 2（注册表） |
| 3.3 同源注入（`z.toJSONSchema` + `.meta` + token 成本） | Task 1（`outputFormatSection`）+ Task 3/4 的 schema 都带 `.meta` |
| 3.4 错误分层 `AiContractError` + 重试一次 | Task 1（错误类型）+ Task 6（重试与反馈） |
| 3.5 计算-后-落库（三处） | Task 7 |
| 3.6 观测 `ai_generations` | Task 5（用量）+ Task 6（落库） |
| 3.7 测试策略 | Task 1/3/4（每 stage 正反例）+ Task 6（重试与审计）+ Task 7（事务不变量） |

**未覆盖（有意）**：设计文档 3.3 的「备选方案（手写说明 + 防漂移测试）」没有实现——因为正选方案（meta 派生）已落地；
若实施时发现提示词变长影响输出质量，再回退到备选，届时 `outputFormatSection` 是唯一改动点。

**占位符扫描**：无 TBD/TODO。所有代码块均为最终形态；schema 的 `.min()/.max()` 边界值是确定值。

**类型一致性核对**
- `PromptStage` / `StageInput` / `StageOutput` 在 Task 2 定义，Task 6 的 `generate<K>` 使用同一套泛型 ✓
- `AiCallContext` 在 Task 6 Step 3 定义（`ai-generation.service.ts`），Task 6 Step 6/8 与 Task 7 均按此签名传参 ✓
- `AIProviderResult` 在 Task 5 定义，Task 6 Step 6 解构 `result.content` / `result.promptTokens` ✓
- `AiContractError.issues` 是 `{ path, message }[]`（Task 1），Task 6 的重试反馈与 `errorDetail` 都按此消费 ✓
- Task 7 的 `ContentService` 构造参数顺序：7 个原依赖 + `dataSource`（第 8 个），与测试的 `new ContentService(...)` 一致 ✓

**已知顺序约束（实施时不要打乱）**
1. Task 1 必须先于 Task 2（`defineTemplate` 是注册表的前提）
2. Task 2 必须先于 Task 3/4（`parse` 的类型推导依赖注册表）
3. Task 5 会短暂打断 `ai-integration` 的 10 处调用（Step 4 用最小改动顶上），Task 6 才彻底重写
4. Task 6 必须先于 Task 7（事务改造要传 `ctx`）
5. Task 7 的 `content.service` 依赖 Task 6 的契约（`result.codeExamples` 保证是数组，故移除 `|| []` 守卫）

**风险与回退**

| 风险 | 应对 |
|---|---|
| 提示词注入 JSON Schema 后变长，影响输出质量或成本 | `outputFormatSection` 是唯一改动点；可退回「手写格式段 + 防漂移测试」 |
| zod `.meta()` 在 `toJSONSchema` 下未带出 description | Task 1 Step 6 的自检脚本里有 `expect(prompt).toContain('标题')` 断言，会立刻暴露 |
| 提示词 contract 变严导致 AI 通过率下降（尤其 stage 3 的 `correctIndex` 不变量） | 重试一次 + 审计表可查失败率；若失败率高，放宽 `.min()/.max()` 而非取消校验 |
| 事务改造引入回归 | 两条「AI 失败 → 事务未开启」不变量测试；`SCHEMA OK` 与 57 个既有测试守住结构 |
| zod 安装被沙箱拒绝 | 对安装命令发起一次 `sandbox_permissions` 升级（见 Global Constraints） |

---

## Execution Handoff

计划已保存到 `docs/plans/2026-09-16-phase3-ai-contract-layer.md`。两种执行方式：

**1. Subagent-Driven** —— 每个 Task 派全新 subagent，任务间两阶段评审。

**2. Inline Execution** —— 当前会话按批次执行，带检查点。

**我建议 Inline**，理由与计划 A 相同：Task 之间是强顺序依赖（见上「已知顺序约束」），且共享同一个数据库与 `.env`；
subagent 无法安全并行触碰同一份环境状态，而仓库体量小、inline 更快更稳。你要求「按进度完成就 commit 一个阶段」，
inline 也更容易在 Task / 阶段边界收口提交。
