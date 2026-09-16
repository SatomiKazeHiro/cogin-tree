# 计划 C 实施计划：产物状态机与 `generateL3` 拆分（阶段 4）

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「一次调用返回 coreText + codeExamples + exercises」拆成三个独立的生成单元，每个单元有自己的契约、状态与生成时机；用 `generation_tasks` 做跨实例幂等；前端改为分块加载（coreText 阻塞、代码示例后台预取、练习题按需）。

**Architecture:** 新增 `GenerationTaskService`（只管状态机，用数据库原子认领替代内存 Map）与 `ArtifactService`（只管编排：认领 → 前置依赖 → 调 AI → 单事务落库 → 标记状态）。HTTP 层新增 `/nodes/:id/artifacts` 读接口与 `/nodes/:id/artifacts/:kind/generate` 生成接口；旧的 `POST/GET /nodes/:id/content` 收窄为 coreText 语义但保持可用。

**Tech Stack:** NestJS 10 · TypeORM 0.3.20（含 raw SQL 原子认领）· PostgreSQL 18.4 · zod ^4（阶段 3 已引入）· Nuxt 3 + Vue 3（前端分块）· ts-jest

**Spec:** `docs/specs/2026-09-16-ai-contract-and-dataflow-design.md`（第 4 节为本计划的直接依据，第 6 节为接口变更）
**前置计划：** `docs/plans/2026-09-16-phase3-ai-contract-layer.md`（已完成并合入 master）
**验证记录：** `docs/plans/2026-09-16-phase3-verification.md`（第四节「沙箱环境知识」务必先读）

## Global Constraints

- **沙箱内 pnpm 需覆盖 `PNPM_HOME`**；`pnpm <script>` 在沙箱不可用（EPERM），一律直接调用 `node_modules/.bin/*`
- **bin 的位置**：根 `node_modules/.bin` 只有 `tsc`；`ts-node` / `jest` / `nest` / `typeorm` 在 `apps/api/node_modules/.bin`。
  从 `packages/prompt-manager` 调用要写 `..\..\apps\api\node_modules\.bin\ts-node`
- **禁止用 PowerShell `Get-Content`/`Set-Content` 读写回环改文本文件**（控制台是 GBK，会写坏 UTF-8 与模板字符串换行）。
  改文件一律用 edit / write 工具
- **改了 `packages/*/src` 必须重新构建 dist**，否则 apps/api 运行时用旧代码：
  - `packages/prompt-manager`：`node_modules/.bin/tsc -p packages/prompt-manager/tsconfig.json`
  - `packages/shared`：`tsc -p packages/shared/tsconfig.json && tsc -p packages/shared/tsconfig.cjs.json`，
    且**同步 `packages/shared/src/index.ts` 的显式具名导出列表**
  - `packages/ai-provider`：`tsc -p packages/ai-provider/tsconfig.json`
- **`@skill/*` 双解析路径**：`tsc` 走 `packages/*/src`（paths），jest/ts-node/nest 运行时走 `packages/*/dist`
- **zod schema 必须保持 JSON-Schema 可表示**（禁 `z.date()`/`z.transform()`/`z.custom()` 等）；
  跨字段约束走 `invariants` 回调，不用 `.refine()`
- **单测不连库**（`new Service(...)` + mock）；Jest 必须 `--runInBand`
- 命令：`cd apps/api; node_modules\.bin\jest --runInBand`；`cd apps/api; node_modules\.bin\tsc --noEmit`
- `psql -c` 里禁止中文字面量（用 `-f` 执行 UTF-8 脚本）
- **每次 `nest start` 前后都要验**：本阶段改动大量 DI 与模块装配，单测与 tsc 都覆盖不到启动期错误
- 提交信息沿用仓库风格；**每个 Task 末尾单独提交，阶段末尾单独提交一次收尾**
- 真实 AI 端到端会消耗 token（`AI_PROVIDER=deepseek` 已配置真实 key），仅 Task 8 需要

---

## File Structure

### 新增

| 文件 | 职责 |
|---|---|
| `packages/prompt-manager/src/templates/stage-3a-l3-core-text.ts` | stage：只生成 coreText（从原 stage 3 拆出） |
| `packages/prompt-manager/src/templates/stage-3b-l3-code-examples.ts` | stage：只生成 codeExamples |
| `packages/prompt-manager/src/templates/stage-3c-l3-exercises.ts` | stage：只生成 exercises |
| `apps/api/src/modules/content/generation-task.service.ts` | `generation_tasks` 状态机（原子认领 / 标记 / 超时回收） |
| `apps/api/src/modules/content/generation-task.service.spec.ts` | 状态机单测 |
| `apps/api/src/modules/content/artifact.service.ts` | 产物编排（认领 → 前置 coreText → AI → 单事务落库 → 标记） |
| `apps/api/src/modules/content/artifact.service.spec.ts` | 编排单测（幂等 / 前置 / 失败标记） |
| `apps/web/components/tree/ArtifactStateHint.vue` | 产物状态提示（生成中 / 失败可重试 / 合法空） |

### 修改

| 文件 | 变更 |
|---|---|
| `packages/shared/src/interfaces/api.ts` | +`NodeArtifactsResponse` / `ArtifactView` 等产物 DTO |
| `packages/shared/src/index.ts` | 若新增枚举则同步（本计划不新增枚举） |
| `packages/prompt-manager/src/prompt-manager.ts` | 注册 3 个新 stage |
| `packages/prompt-manager/src/templates/stage-3-l3-content.ts` | 删除（被三个新 stage 取代） |
| `packages/prompt-manager/src/stages.selfcheck.ts` | 扩展三个新 stage 的正反例；移除 l3-content 的用例 |
| `apps/api/src/modules/content/content.controller.ts` | +`GET /nodes/:id/artifacts`、`POST /nodes/:id/artifacts/:kind/generate`；legacy 端点语义收窄 |
| `apps/api/src/modules/content/content.service.ts` | `generateContent` 改为「确保 coreText」；`getContentByNodeId` 附带产物状态 |
| `apps/api/src/modules/content/content.module.ts` | 注册 `GenerationTaskService` / `ArtifactService` / `GenerationTask` 实体 |
| `apps/web/composables/useSkillTreePage.ts` | 内容状态 → 产物状态；`ensureCoreText` / `generateArtifact` / 预取 |
| `apps/web/composables/useTreeLayout.ts` | `contents` 参数改为 `contentReadyByNodeId: Record<string, boolean>` |
| `apps/web/components/tree/L2ContentPanel.vue` | props 由 `content` 改为 `artifacts`；透传状态与重试事件 |
| `apps/web/components/tree/L3Content.vue` | 每个 section 独立渲染产物状态（生成中 / 失败重试 / 空） |
| `apps/web/pages/skills/[id]/tree.vue` | 接线新的 props 与事件 |

---

## Task 1: 拆分 `generateL3` 为三个 stage 契约

**Files:**
- Create: `packages/prompt-manager/src/templates/stage-3a-l3-core-text.ts`
- Create: `packages/prompt-manager/src/templates/stage-3b-l3-code-examples.ts`
- Create: `packages/prompt-manager/src/templates/stage-3c-l3-exercises.ts`
- Delete: `packages/prompt-manager/src/templates/stage-3-l3-content.ts`
- Modify: `packages/prompt-manager/src/prompt-manager.ts`
- Modify: `packages/prompt-manager/src/stages.selfcheck.ts`

**Interfaces:**
- Produces: stage 名 `l3-core-text` / `l3-code-examples` / `l3-exercises`；对应 `StageInput` / `StageOutput` 类型
- 输入设计：三个 stage 都接收 `{ skillTreeName, l1Title, l2Title }`；**后两者额外接收 `coreText`**（由服务保证先有 coreText），以保证示例与练习题与核心内容一致

- [ ] **Step 1: 扩展自检（先红）**

在 `packages/prompt-manager/src/stages.selfcheck.ts` 中，把原 l3-content 的用例**替换**为：

```ts
// ── stage 3a：l3-core-text ────────────────────────────────────────
const coreOk = JSON.stringify({ coreText: '## 小节\n正文'.padEnd(80, '。') });
const core = PromptManager.parse('l3-core-text', coreOk);
assert(core.coreText.length >= 50, 'l3-core-text 正例');
expectContractError('l3-core-text', '{"coreText":"太短"}', 'l3-core-text 过短被拒');
expectContractError('l3-core-text', '{}', 'l3-core-text 缺字段被拒');

// ── stage 3b：l3-code-examples ────────────────────────────────────
const codesOk = JSON.stringify({
  codeExamples: [{ title: '示例', language: 'ts', code: 'const a = 1;' }],
});
assert(
  PromptManager.parse('l3-code-examples', codesOk).codeExamples.length === 1,
  'l3-code-examples 正例',
);
assert(
  PromptManager.parse('l3-code-examples', '{"codeExamples":[]}').codeExamples.length === 0,
  'l3-code-examples 允许空数组（纯概念主题）',
);
expectContractError(
  'l3-code-examples',
  JSON.stringify({ codeExamples: [{ title: 't', language: 'ts' }] }),
  'l3-code-examples 缺 code 被拒',
);
expectContractError(
  'l3-code-examples',
  JSON.stringify({ codeExamples: Array.from({ length: 4 }, (_, i) => ({ title: `t${i}`, language: 'ts', code: 'c' })) }),
  'l3-code-examples 超过 3 个被拒',
);

// ── stage 3c：l3-exercises ────────────────────────────────────────
const exOk = JSON.stringify({
  exercises: [{ question: 'Q', options: ['a', 'b'], correctIndex: 1, explanation: 'E' }],
});
assert(PromptManager.parse('l3-exercises', exOk).exercises.length === 1, 'l3-exercises 正例');
expectContractError('l3-exercises', '{"exercises":[]}', 'l3-exercises 空数组被拒');
expectContractError(
  'l3-exercises',
  JSON.stringify({ exercises: [{ question: 'Q', options: ['a'], correctIndex: 0, explanation: 'E' }] }),
  'l3-exercises 选项少于 2 个被拒',
);
expectContractError(
  'l3-exercises',
  JSON.stringify({ exercises: [{ question: 'Q', options: ['a', 'b'], correctIndex: 2, explanation: 'E' }] }),
  'l3-exercises correctIndex 越界被 invariants 拒（跨字段）',
);

// ── 提示词格式段与 schema 同源 ─────────────────────────────────────
const corePrompt = PromptManager.build('l3-core-text', {
  skillTreeName: 'T',
  l1Title: 'L1',
  l2Title: 'L2',
});
assert(corePrompt.includes('"coreText"'), 'l3-core-text 提示词含 coreText 字段说明');

const exPrompt = PromptManager.build('l3-exercises', {
  skillTreeName: 'T',
  l1Title: 'L1',
  l2Title: 'L2',
  coreText: '核心内容',
});
assert(exPrompt.includes('"exercises"'), 'l3-exercises 提示词含 exercises 字段说明');
assert(exPrompt.includes('核心内容'), 'l3-exercises 提示词带上了 coreText 作为上下文');
```

同时把 `PROMPT_STAGES.length === 9` 的断言（在 `prompt-manager.selfcheck.ts`）改为 `11`。

```powershell
cd packages/prompt-manager
..\..\apps\api\node_modules\.bin\ts-node src/stages.selfcheck.ts
```
Expected: FAIL —— `l3-core-text` 等 stage 未注册

- [ ] **Step 2: 建三个 stage 文件**

`stage-3a-l3-core-text.ts`：

```ts
import * as z from 'zod';
import { defineTemplate } from '../prompt-engine';

export interface L3CoreTextInput {
  skillTreeName: string;
  l1Title: string;
  l2Title: string;
}

export const l3CoreTextSchema = z.object({
  coreText: z
    .string()
    .min(50)
    .max(6000)
    .meta({ description: '核心学习内容，Markdown 排版，300-800 字' }),
});
export type L3CoreTextOutput = z.infer<typeof l3CoreTextSchema>;

/**
 * Stage 3a：L3 核心文本（从原 stage 3 拆出）。
 * 只负责「概念讲解」，不再顺带产出代码示例与练习题 —— 三者边界清晰、可独立失败与重试。
 */
export const stage3aL3CoreText = defineTemplate<L3CoreTextInput, L3CoreTextOutput>({
  version: '1.0.0',
  stage: 'l3-core-text',
  schema: l3CoreTextSchema,
  body: (input) => `
角色：你是一位资深的技术内容作者。
任务：为一个 L2 学习主题撰写核心学习内容。L3 代表"具体学什么"，是可直接学习的知识点。

输入：
- 技能方向：${input.skillTreeName}
- L1 节点：${input.l1Title}
- L2 节点：${input.l2Title}

要求：
1. 用中文撰写 300-800 字的核心学习内容，解释概念、用途、注意事项。
2. 必须使用 Markdown 格式排版，避免写成一整个长段落。
3. 使用二级标题（##）划分小节，例如：基本语法、使用场景、注意事项、常见误区等。
4. 使用列表（- 或 1.）展示并列点、步骤或示例。
5. 关键术语、函数名等使用行内代码或加粗突出。
6. 每个段落控制在 3-5 句话以内，段落之间留出空行。
7. 只讲概念与用法，不要展开完整代码实现，也不要出练习题（另有步骤负责）。
`,
});
```

`stage-3b-l3-code-examples.ts`：

```ts
import * as z from 'zod';
import { defineTemplate } from '../prompt-engine';
import { codeExampleSchema } from '../schemas/common';

export interface L3CodeExamplesInput {
  skillTreeName: string;
  l1Title: string;
  l2Title: string;
  /** 已生成的核心内容，作为上下文保证示例与讲解一致 */
  coreText: string;
}

export const l3CodeExamplesSchema = z.object({
  codeExamples: z
    .array(codeExampleSchema)
    .max(3)
    .meta({ description: '代码示例；纯概念主题可为空数组' }),
});
export type L3CodeExamplesOutput = z.infer<typeof l3CodeExamplesSchema>;

/**
 * Stage 3b：L3 代码示例（从原 stage 3 拆出）。
 * 输入带 coreText，确保示例与核心讲解一致（这是拆分后仍保持内容连贯的关键）。
 */
export const stage3bL3CodeExamples = defineTemplate<L3CodeExamplesInput, L3CodeExamplesOutput>({
  version: '1.0.0',
  stage: 'l3-code-examples',
  schema: l3CodeExamplesSchema,
  body: (input) => `
角色：你是一位资深的技术内容作者，擅长编写可运行的示例代码。
任务：为下面这个学习主题提供 1-3 个可运行的代码示例。

输入：
- 技能方向：${input.skillTreeName}
- L1 节点：${input.l1Title}
- L2 节点：${input.l2Title}
- 已撰写的核心内容：
${input.coreText}

要求：
1. 提供 1-3 个与核心内容直接相关的代码示例，每个含 title、language、code。
2. code 要完整可运行或为核心片段，并带关键注释。
3. 示例必须紧扣上面的核心内容，不要引入未讲解的概念。
4. 如果该主题是纯概念性、不需要代码的，返回空数组。
`,
});
```

`stage-3c-l3-exercises.ts`：

```ts
import * as z from 'zod';
import { defineTemplate } from '../prompt-engine';
import { exerciseSchema } from '../schemas/common';

export interface L3ExercisesInput {
  skillTreeName: string;
  l1Title: string;
  l2Title: string;
  /** 已生成的核心内容，作为出题依据 */
  coreText: string;
}

export const l3ExercisesSchema = z.object({
  exercises: z.array(exerciseSchema).min(1).max(6).meta({ description: '单选题，4-6 道' }),
});
export type L3ExercisesOutput = z.infer<typeof l3ExercisesSchema>;

/**
 * Stage 3c：L3 练习题（从原 stage 3 拆出）。
 * 出题依据是 coreText，避免「题目考了没讲过的内容」。
 */
export const stage3cL3Exercises = defineTemplate<L3ExercisesInput, L3ExercisesOutput>({
  version: '1.0.0',
  stage: 'l3-exercises',
  schema: l3ExercisesSchema,
  // JSON Schema 无法表达「correctIndex 必须落在 options 下标范围内」，故走 invariants
  invariants: (v) =>
    v.exercises
      .map((ex, i) =>
        ex.correctIndex >= ex.options.length
          ? `exercises[${i}].correctIndex=${ex.correctIndex} 超出 options 下标范围(0..${ex.options.length - 1})`
          : null,
      )
      .filter((m): m is string => !!m),
  body: (input) => `
角色：你是一位资深的技术题库设计师。
任务：基于下面这个学习主题的核心内容，设计 4-6 道单选题，用于检验掌握程度。

输入：
- 技能方向：${input.skillTreeName}
- L1 节点：${input.l1Title}
- L2 节点：${input.l2Title}
- 核心内容：
${input.coreText}

要求：
1. 出 4-6 道单选题，每题 4 个选项，correctIndex 必须落在 options 的下标范围内。
2. 题目只能考察上面核心内容里讲过的知识，不要超纲。
3. 覆盖不同层次：概念辨析、使用场景、常见误区。
4. explanation 要说明为什么正确、以及常见错误选项错在哪。
`,
});
```

- [ ] **Step 3: 更新注册表**

`packages/prompt-manager/src/prompt-manager.ts`：移除 `stage3L3Content` 的 import 与注册项，加入三个新 stage：

```ts
import { stage3aL3CoreText } from './templates/stage-3a-l3-core-text';
import { stage3bL3CodeExamples } from './templates/stage-3b-l3-code-examples';
import { stage3cL3Exercises } from './templates/stage-3c-l3-exercises';

export const PROMPT_TEMPLATES = {
  'knowledge-points': stage0KnowledgePoints,
  'l1-outline': stage1L1Outline,
  'l2-nodes': stage2L2Nodes,
  'l3-core-text': stage3aL3CoreText,
  'l3-code-examples': stage3bL3CodeExamples,
  'l3-exercises': stage3cL3Exercises,
  'discover-new': stage4DiscoverNew,
  'check-expire': stage5CheckExpire,
  'interview-qa': stage6InterviewQA,
  portrait: stage7Portrait,
  recommendations: stage8Recommendations,
} as const;
```

底部具名导出同步为三个新 stage（删除 `stage3L3Content`）。

- [ ] **Step 4: 删除旧 stage 文件**

```powershell
Remove-Item packages/prompt-manager/src/templates/stage-3-l3-content.ts
```

`packages/prompt-manager/src/index.ts` 里若有该文件的导出行，一并删除。

- [ ] **Step 5: 更新仓库内对旧 stage 的引用**

`apps/api/src/modules/ai-integration/ai-integration.service.ts`：删除 `generateL3` 方法（Task 4 会换成三个新方法）。
在 Task 1 先把它改为三个薄封装（保持编译通过）：

```ts
  async generateL3CoreText(
    input: { skillTreeName: string; l1Title: string; l2Title: string },
    ctx: AiCallContext = {},
  ) {
    return this.generate('l3-core-text', input, ctx, { maxTokens: this.l3MaxTokens() });
  }

  async generateL3CodeExamples(
    input: { skillTreeName: string; l1Title: string; l2Title: string; coreText: string },
    ctx: AiCallContext = {},
  ) {
    return this.generate('l3-code-examples', input, ctx, { maxTokens: this.l3MaxTokens() });
  }

  async generateL3Exercises(
    input: { skillTreeName: string; l1Title: string; l2Title: string; coreText: string },
    ctx: AiCallContext = {},
  ) {
    return this.generate('l3-exercises', input, ctx, { maxTokens: this.l3MaxTokens() });
  }
```

同时把 `content.service.ts` 里现有的 `generateL3(...)` 调用临时改为 `generateL3CoreText(...)`，
并让它只写 coreText（代码示例与练习的写入在 Task 4 移到 `ArtifactService`）：

```ts
    const result = await this.aiService.generateL3CoreText(
      { skillTreeName: tree?.name || '', l1Title: l1Node?.title || '', l2Title: node.title },
      { userId, treeId: node.treeId, nodeId },
    );
```
随后事务里只写 `node_contents`（保留 codeExamples/exercises 的写入代码暂时删除也可以 —— 但为了本 Task 编译与测试通过，**最简单是保留写入但用空数组**）：
```ts
      // 拆分后本方法只负责 coreText；code_examples / exercises 由 ArtifactService 生成
      const saved = await contentRepo.save(
        contentRepo.create({ nodeId, coreText: result.coreText, version: 1 }),
      );
```
（删除该方法内 codeExampleRepo / exerciseRepo 的写入段落，以及事务里对应的 `manager.getRepository(...)` 两行）

**受影响的测试**：`content.service.transaction.spec.ts` 与 `content.service.spec.ts` 里对
`aiService.generateL3` 的 mock 与断言要改为 `generateL3CoreText`，且不再断言 `txCode.save` / `txExercise.save`。
（Task 4 会把这两个 spec 整体重写为 ArtifactService 的测试，本 Task 先做最小改动保持绿色。）

- [ ] **Step 6: 跑自检 + 类型检查 + 全量测试**

```powershell
cd packages/prompt-manager
..\..\apps\api\node_modules\.bin\ts-node src/prompt-engine.selfcheck.ts
..\..\apps\api\node_modules\.bin\ts-node src/prompt-manager.selfcheck.ts
..\..\apps\api\node_modules\.bin\ts-node src/stages.selfcheck.ts
..\..\node_modules\.bin\tsc -p tsconfig.json
cd ../../apps/api
node_modules\.bin\tsc --noEmit
node_modules\.bin\jest --runInBand
```
Expected: 三个 `SELFCHECK OK`；两边 `tsc` exit 0；jest 全绿（`PROMPT_STAGES.length` 已改为 11）

- [ ] **Step 7: 提交**

```powershell
git add packages/prompt-manager apps/api/src/modules
git commit -m "✨ feat: 拆分 generateL3 为三个 stage 契约（core-text / code-examples / exercises）"
```

---

## Task 2: shared 新增产物 DTO 类型

**Files:**
- Modify: `packages/shared/src/interfaces/api.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ArtifactStatusView { status: GenerationTaskStatus; attempts: number; lastError?: string | null }
  export interface NodeArtifactsResponse {
    coreText: ArtifactStatusView & { text: string | null };
    codeExamples: ArtifactStatusView & { items: { title: string; language: string; code: string }[] };
    exercises: ArtifactStatusView & { items: { question: string; options: string[]; correctIndex: number; explanation: string }[] };
  }
  ```

- [ ] **Step 1: 加类型**

`packages/shared/src/interfaces/api.ts` 追加（`GenerationTaskStatus` 从 `../enums` 引入）：

```ts
/** 单个产物的状态视图（状态来自 generation_tasks，内容来自各自的业务表） */
export interface ArtifactStatusView {
  status: GenerationTaskStatus;
  attempts: number;
  lastError?: string | null;
}

export interface ArtifactCodeExample {
  title: string;
  language: string;
  code: string;
}

export interface ArtifactExercise {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

/** GET /nodes/:id/artifacts 的响应：三类产物的状态 + 已就绪内容（前端分块渲染依据） */
export interface NodeArtifactsResponse {
  coreText: ArtifactStatusView & { text: string | null };
  codeExamples: ArtifactStatusView & { items: ArtifactCodeExample[] };
  exercises: ArtifactStatusView & { items: ArtifactExercise[] };
}
```

- [ ] **Step 2: 构建并验证导出**

```powershell
node_modules\.bin\tsc -p packages/shared/tsconfig.json
node_modules\.bin\tsc -p packages/shared/tsconfig.cjs.json
Select-String -Path packages/shared/dist/types/interfaces/api.d.ts -Pattern "NodeArtifactsResponse" -SimpleMatch -Quiet
```
Expected: `True`（types/esm/cjs 三份产物都含新类型）

- [ ] **Step 3: 类型检查 + 提交**

```powershell
cd apps/api; node_modules\.bin\tsc --noEmit
git add packages/shared
git commit -m "✨ feat: shared 新增产物 DTO（NodeArtifactsResponse / ArtifactStatusView）"
```

---

## Task 3: `GenerationTaskService` —— 状态机与原子认领

**Files:**
- Create: `apps/api/src/modules/content/generation-task.service.ts`
- Create: `apps/api/src/modules/content/generation-task.service.spec.ts`

**Interfaces:**
- Produces:
  - `claim(nodeId: string, kind: ArtifactKind): Promise<boolean>` —— 抢到返回 true；他人正在生成/已 READY 返回 false
  - `markReady(nodeId: string, kind: ArtifactKind, meta: { promptVersion: string; model?: string }): Promise<void>`
  - `markFailed(nodeId: string, kind: ArtifactKind, error: string): Promise<void>`
  - `findForNode(nodeId: string): Promise<GenerationTask[]>`

**为什么用数据库认领**：现有 `interview.service.ts` 用内存 `Map<nodeId, Promise>` 做并发去重，
**进程重启即失效、多实例下完全失效**。`generation_tasks` 的 `UNIQUE(node_id, artifact_kind)` + 条件 UPDATE 是跨实例的锁。

- [ ] **Step 1: 写失败测试**

创建 `apps/api/src/modules/content/generation-task.service.spec.ts`：

```ts
import { GenerationTaskService, STALE_GENERATING_MS } from './generation-task.service';
import { ArtifactKind, GenerationTaskStatus } from '@skill/shared';
import { GenerationTask } from './entities/generation-task.entity';

describe('GenerationTaskService', () => {
  let service: GenerationTaskService;
  let dataSource: { query: jest.Mock };
  let taskRepo: { update: jest.Mock; find: jest.Mock };

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    taskRepo = { update: jest.fn(), find: jest.fn() };
    service = new GenerationTaskService(dataSource as never, taskRepo as never);
  });

  it('抢到任务（INSERT 成功）返回 true', async () => {
    dataSource.query.mockResolvedValue([{ id: 'task-1' }]);

    await expect(service.claim('n1', ArtifactKind.L3_CORE_TEXT)).resolves.toBe(true);
    expect(dataSource.query).toHaveBeenCalledTimes(1);
    const sql = dataSource.query.mock.calls[0][0] as string;
    expect(sql).toContain('on conflict (node_id, artifact_kind) do update');
    // 只有 PENDING / FAILED / 陈旧 GENERATING 才允许认领，READY 绝不能被抢走
    expect(sql).toContain("status in ('PENDING', 'FAILED')");
    expect(sql).toContain('interval');
  });

  it('抢不到（他人正在生成或已 READY）返回 false', async () => {
    dataSource.query.mockResolvedValue([]);
    await expect(service.claim('n1', ArtifactKind.L3_EXERCISES)).resolves.toBe(false);
  });

  it('陈旧阈值是 120 秒（传给 SQL）', async () => {
    dataSource.query.mockResolvedValue([]);
    await service.claim('n1', ArtifactKind.L3_CORE_TEXT);

    const params = dataSource.query.mock.calls[0][1] as unknown[];
    expect(params).toContain(STALE_GENERATING_MS);
    expect(STALE_GENERATING_MS).toBe(120_000);
  });

  it('markReady 写入状态、版本、模型与结束时间', async () => {
    await service.markReady('n1', ArtifactKind.L3_CORE_TEXT, {
      promptVersion: '1.0.0',
      model: 'deepseek-flash',
    });

    expect(taskRepo.update).toHaveBeenCalledWith(
      { nodeId: 'n1', artifactKind: ArtifactKind.L3_CORE_TEXT },
      expect.objectContaining({
        status: GenerationTaskStatus.READY,
        promptVersion: '1.0.0',
        model: 'deepseek-flash',
        lastError: null,
      }),
    );
  });

  it('markFailed 写入 FAILED 与错误摘要（截断到 1000 字）', async () => {
    await service.markFailed('n1', ArtifactKind.L3_EXERCISES, 'x'.repeat(1500));

    const payload = taskRepo.update.mock.calls[0][1] as { status: string; lastError: string };
    expect(payload.status).toBe(GenerationTaskStatus.FAILED);
    expect(payload.lastError.length).toBe(1000);
  });

  it('findForNode 按 kind 返回', async () => {
    taskRepo.find.mockResolvedValue([{ nodeId: 'n1' } as GenerationTask]);
    await expect(service.findForNode('n1')).resolves.toHaveLength(1);
    expect(taskRepo.find).toHaveBeenCalledWith({ where: { nodeId: 'n1' } });
  });
});
```

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/content/generation-task
```
Expected: FAIL —— 模块不存在

- [ ] **Step 2: 实现**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ArtifactKind, GenerationTaskStatus } from '@skill/shared';
import { GenerationTask } from './entities/generation-task.entity';

/** GENERATING 超过该时长即视为僵死，可被重新认领 */
export const STALE_GENERATING_MS = 120_000;

/**
 * 产物生成状态机。
 *
 * 认领是**数据库级**的原子操作（UNIQUE(node_id, artifact_kind) + 条件 UPDATE），
 * 因此跨进程/跨实例安全 —— 这是它取代内存 Map 的原因。
 */
@Injectable()
export class GenerationTaskService {
  private readonly logger = new Logger(GenerationTaskService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(GenerationTask)
    private readonly taskRepo: Repository<GenerationTask>,
  ) {}

  /**
   * 尝试认领 (nodeId, kind) 的生成权。
   * 返回 true 表示本次由调用方生成；false 表示已 READY，或他人正在生成且未超时。
   */
  async claim(nodeId: string, kind: ArtifactKind): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(
      `insert into generation_tasks (node_id, artifact_kind, status, attempts, started_at)
       values ($1, $2, 'GENERATING', 1, now())
       on conflict (node_id, artifact_kind) do update
         set status = 'GENERATING',
             attempts = generation_tasks.attempts + 1,
             started_at = now(),
             updated_at = now()
         where generation_tasks.status in ('PENDING', 'FAILED')
            or (generation_tasks.status = 'GENERATING'
                and generation_tasks.started_at < now() - ($3::int * interval '1 millisecond'))
       returning id`,
      [nodeId, kind, STALE_GENERATING_MS],
    );
    return rows.length > 0;
  }

  async markReady(
    nodeId: string,
    kind: ArtifactKind,
    meta: { promptVersion: string; model?: string },
  ): Promise<void> {
    await this.taskRepo.update(
      { nodeId, artifactKind: kind },
      {
        status: GenerationTaskStatus.READY,
        promptVersion: meta.promptVersion,
        model: meta.model ?? null,
        lastError: null,
        finishedAt: new Date(),
      },
    );
  }

  async markFailed(nodeId: string, kind: ArtifactKind, error: string): Promise<void> {
    await this.taskRepo.update(
      { nodeId, artifactKind: kind },
      {
        status: GenerationTaskStatus.FAILED,
        lastError: error.slice(0, 1000),
        finishedAt: new Date(),
      },
    );
  }

  async findForNode(nodeId: string): Promise<GenerationTask[]> {
    return this.taskRepo.find({ where: { nodeId } });
  }
}
```

- [ ] **Step 3: 跑测试确认通过**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/content/generation-task
```
Expected: PASS（6 用例）

- [ ] **Step 4: 类型检查 + 提交**

```powershell
cd apps/api; node_modules\.bin\tsc --noEmit
git add apps/api/src/modules/content
git commit -m "✨ feat: GenerationTaskService 状态机（数据库级原子认领，替代内存 Map）"
```

---

## Task 4: `ArtifactService` —— 产物生成编排

**Files:**
- Create: `apps/api/src/modules/content/artifact.service.ts`
- Create: `apps/api/src/modules/content/artifact.service.spec.ts`
- Modify: `apps/api/src/modules/content/content.service.ts`（`generateContent` 委托给 ArtifactService 语义）
- Modify: `apps/api/src/modules/content/content.module.ts`

**Interfaces:**
- Consumes: `GenerationTaskService`（Task 3）、`AiIntegrationService.generateL3CoreText/generateL3CodeExamples/generateL3Exercises`（Task 1）、`TreeAccessService`
- Produces:
  - `getArtifacts(nodeId: string, userId: string): Promise<NodeArtifactsResponse>`
  - `generateArtifact(nodeId: string, userId: string, kind: ArtifactKind): Promise<NodeArtifactsResponse>`

**关键编排规则**：
1. 认领失败 → 直接返回当前状态（幂等：已 READY 不重复调 AI；他人生成中不重复调 AI）
2. `L3_CODE_EXAMPLES` / `L3_EXERCISES` 需要 coreText：若 coreText 未就绪，**先生成 coreText**（前置依赖）
3. 落库在单事务内；成功 → `markReady`；失败 → `markFailed` 后抛出（让 HTTP 层返回错误）
4. 状态读取时，若无 task 行但内容已存在（历史数据/直写），状态按 **READY** 呈现

- [ ] **Step 1: 写失败测试**

创建 `apps/api/src/modules/content/artifact.service.spec.ts`：

```ts
import { ArtifactService } from './artifact.service';
import { NodeContent } from './entities/node-content.entity';
import { CodeExample } from './entities/code-example.entity';
import { Exercise } from './entities/exercise.entity';
import { ArtifactKind, GenerationTaskStatus, NodeLevel } from '@skill/shared';

describe('ArtifactService', () => {
  let service: ArtifactService;
  let manager: { getRepository: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let tasks: { claim: jest.Mock; markReady: jest.Mock; markFailed: jest.Mock; findForNode: jest.Mock };
  let ai: {
    generateL3CoreText: jest.Mock;
    generateL3CodeExamples: jest.Mock;
    generateL3Exercises: jest.Mock;
  };
  let treeAccess: { assertNodeOwner: jest.Mock };
  let nodeRepo: { findOne: jest.Mock };
  let treeRepo: { findOne: jest.Mock };
  let contentRepo: { findOne: jest.Mock };
  let txContent: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock };
  let txCode: { create: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let txExercise: { create: jest.Mock; save: jest.Mock; delete: jest.Mock };

  const node = {
    id: 'n1',
    treeId: 't1',
    parentId: 'l1',
    level: NodeLevel.L2,
    title: 'L2 主题',
    description: 'd',
  };

  beforeEach(() => {
    txContent = {
      findOne: jest.fn(async () => null),
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ ...v, id: 'c1' })),
      update: jest.fn(),
    };
    txCode = { create: jest.fn((v) => v), save: jest.fn(async (v) => v), delete: jest.fn() };
    txExercise = { create: jest.fn((v) => v), save: jest.fn(async (v) => v), delete: jest.fn() };
    manager = {
      getRepository: jest.fn((e: unknown) => {
        if (e === NodeContent) return txContent;
        if (e === CodeExample) return txCode;
        if (e === Exercise) return txExercise;
        throw new Error('unexpected entity');
      }),
    };
    dataSource = { transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) => cb(manager)) };

    tasks = {
      claim: jest.fn(async () => true),
      markReady: jest.fn(async () => undefined),
      markFailed: jest.fn(async () => undefined),
      findForNode: jest.fn(async () => []),
    };
    ai = {
      generateL3CoreText: jest.fn(async () => ({ coreText: '核心内容'.padEnd(60, '。') })),
      generateL3CodeExamples: jest.fn(async () => ({ codeExamples: [{ title: 't', language: 'ts', code: 'c' }] })),
      generateL3Exercises: jest.fn(async () => ({
        exercises: [{ question: 'Q', options: ['a', 'b'], correctIndex: 0, explanation: 'E' }],
      })),
    };
    treeAccess = { assertNodeOwner: jest.fn(async () => node) };
    nodeRepo = { findOne: jest.fn(async () => ({ id: 'l1', title: 'L1' })) };
    treeRepo = { findOne: jest.fn(async () => ({ id: 't1', name: 'T' })) };
    contentRepo = { findOne: jest.fn(async () => null) };

    service = new ArtifactService(
      dataSource as never,
      tasks as never,
      ai as never,
      treeAccess as never,
      nodeRepo as never,
      treeRepo as never,
      contentRepo as never,
    );
  });

  it('coreText：认领成功 → 调 AI → 单事务写 node_contents → markReady', async () => {
    await service.generateArtifact('n1', 'u1', ArtifactKind.L3_CORE_TEXT);

    expect(tasks.claim).toHaveBeenCalledWith('n1', ArtifactKind.L3_CORE_TEXT);
    expect(ai.generateL3CoreText).toHaveBeenCalledWith(
      expect.objectContaining({ l2Title: 'L2 主题', skillTreeName: 'T' }),
      expect.objectContaining({ userId: 'u1', treeId: 't1', nodeId: 'n1' }),
    );
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(txContent.save).toHaveBeenCalled();
    expect(tasks.markReady).toHaveBeenCalledWith(
      'n1',
      ArtifactKind.L3_CORE_TEXT,
      expect.objectContaining({ promptVersion: expect.any(String) }),
    );
  });

  it('认领失败（已 READY 或他人生成中）→ 完全不调 AI（幂等）', async () => {
    tasks.claim.mockResolvedValue(false);

    await service.generateArtifact('n1', 'u1', ArtifactKind.L3_CORE_TEXT);

    expect(ai.generateL3CoreText).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('生成 codeExamples 时若 coreText 未就绪 → 先生成 coreText（前置依赖）', async () => {
    // coreText 任务不存在且内容为空 → 需要前置生成
    contentRepo.findOne.mockResolvedValue(null);

    await service.generateArtifact('n1', 'u1', ArtifactKind.L3_CODE_EXAMPLES);

    expect(ai.generateL3CoreText).toHaveBeenCalledTimes(1);
    expect(ai.generateL3CodeExamples).toHaveBeenCalledWith(
      expect.objectContaining({ coreText: expect.stringContaining('核心内容') }),
      expect.anything(),
    );
  });

  it('已有 coreText 时不再前置生成，且把它传给 codeExamples 作为上下文', async () => {
    contentRepo.findOne.mockResolvedValue({ id: 'c1', nodeId: 'n1', coreText: '已有核心内容' });

    await service.generateArtifact('n1', 'u1', ArtifactKind.L3_CODE_EXAMPLES);

    expect(ai.generateL3CoreText).not.toHaveBeenCalled();
    expect(ai.generateL3CodeExamples).toHaveBeenCalledWith(
      expect.objectContaining({ coreText: '已有核心内容' }),
      expect.anything(),
    );
  });

  it('AI 失败 → markFailed 并抛出（不静默降级）', async () => {
    // 预置 coreText，跳过前置生成，让失败点精确落在 exercises 上
    contentRepo.findOne.mockResolvedValue({ id: 'c1', nodeId: 'n1', coreText: '已有核心内容' });
    ai.generateL3Exercises.mockRejectedValue(new Error('AI down'));

    await expect(
      service.generateArtifact('n1', 'u1', ArtifactKind.L3_EXERCISES),
    ).rejects.toThrow('AI down');

    expect(tasks.markFailed).toHaveBeenCalledWith(
      'n1',
      ArtifactKind.L3_EXERCISES,
      expect.stringContaining('AI down'),
    );
    // 失败发生在写库之前，因此没有产生任何写入
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('getArtifacts：无 task 行但内容存在 → 状态按 READY 呈现（兼容历史数据）', async () => {
    tasks.findForNode.mockResolvedValue([]);
    contentRepo.findOne.mockResolvedValue({
      id: 'c1',
      nodeId: 'n1',
      coreText: '已有',
      codeExamples: [],
      exercises: [],
    });

    const view = await service.getArtifacts('n1', 'u1');

    expect(view.coreText.status).toBe(GenerationTaskStatus.READY);
    expect(view.coreText.text).toBe('已有');
  });

  it('getArtifacts：无 task 行且无内容 → PENDING', async () => {
    tasks.findForNode.mockResolvedValue([]);
    contentRepo.findOne.mockResolvedValue(null);

    const view = await service.getArtifacts('n1', 'u1');

    expect(view.coreText.status).toBe(GenerationTaskStatus.PENDING);
    expect(view.exercises.items).toEqual([]);
  });
});
```

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/content/artifact
```
Expected: FAIL —— 模块不存在

- [ ] **Step 2: 实现 `ArtifactService`**

要点（完整实现）：构造注入 `DataSource` / `GenerationTaskService` / `AiIntegrationService` /
`TreeAccessService` / `NodeContent` `TreeNode` `SkillTree` 三个 repo。

```ts
  private async loadContext(nodeId: string, userId: string) {
    const node = await this.treeAccess.assertNodeOwner(nodeId, userId);
    const [l1Node, tree] = await Promise.all([
      this.nodeRepo.findOne({ where: { id: node.parentId } }),
      this.treeRepo.findOne({ where: { id: node.treeId } }),
    ]);
    return { node, skillTreeName: tree?.name || '', l1Title: l1Node?.title || '' };
  }

  private async loadContent(nodeId: string): Promise<NodeContent | null> {
    return this.contentRepo.findOne({
      where: { nodeId },
      relations: ['exercises', 'codeExamples'],
      order: { exercises: { sortOrder: 'ASC' }, codeExamples: { sortOrder: 'ASC' } },
    });
  }

  /** 确保 coreText 就绪（供 codeExamples / exercises 作为前置依赖调用） */
  private async ensureCoreText(nodeId: string, userId: string): Promise<string> {
    const existing = await this.loadContent(nodeId);
    if (existing?.coreText) return existing.coreText;
    await this.generateArtifact(nodeId, userId, ArtifactKind.L3_CORE_TEXT);
    const after = await this.loadContent(nodeId);
    if (!after?.coreText) {
      throw new InternalServerErrorException('coreText 生成后仍不可用');
    }
    return after.coreText;
  }
```

`generateArtifact` 的主流程：

```ts
  async generateArtifact(nodeId: string, userId: string, kind: ArtifactKind): Promise<NodeArtifactsResponse> {
    const { node, skillTreeName, l1Title } = await this.loadContext(nodeId, userId);
    const aiCtx = { userId, treeId: node.treeId, nodeId };

    const claimed = await this.tasks.claim(nodeId, kind);
    if (!claimed) {
      // 已 READY 或他人正在生成：幂等返回当前状态，绝不重复调 AI
      return this.getArtifacts(nodeId, userId);
    }

    try {
      if (kind === ArtifactKind.L3_CORE_TEXT) {
        const result = await this.ai.generateL3CoreText(
          { skillTreeName, l1Title, l2Title: node.title },
          aiCtx,
        );
        await this.dataSource.transaction(async (manager) => {
          const repo = manager.getRepository(NodeContent);
          const existing = await repo.findOne({ where: { nodeId } });
          if (existing) {
            await repo.update({ nodeId }, { coreText: result.coreText, version: existing.version + 1 });
          } else {
            await repo.save(repo.create({ nodeId, coreText: result.coreText, version: 1 }));
          }
        });
      } else {
        // 前置依赖：示例与练习题都以 coreText 为依据
        const coreText = await this.ensureCoreText(nodeId, userId);

        if (kind === ArtifactKind.L3_CODE_EXAMPLES) {
          const result = await this.ai.generateL3CodeExamples(
            { skillTreeName, l1Title, l2Title: node.title, coreText },
            aiCtx,
          );
          await this.dataSource.transaction(async (manager) => {
            const contentRepo = manager.getRepository(NodeContent);
            const codeRepo = manager.getRepository(CodeExample);
            const content = await contentRepo.findOne({ where: { nodeId } });
            if (!content) throw new InternalServerErrorException('缺少 node_contents，无法写入代码示例');
            await codeRepo.delete({ nodeContentId: content.id });
            if (result.codeExamples.length > 0) {
              await codeRepo.save(
                result.codeExamples.map((item, index) =>
                  codeRepo.create({
                    nodeContentId: content.id,
                    title: item.title,
                    language: item.language,
                    code: item.code,
                    sortOrder: index,
                  }),
                ),
              );
            }
          });
        } else {
          const result = await this.ai.generateL3Exercises(
            { skillTreeName, l1Title, l2Title: node.title, coreText },
            aiCtx,
          );
          await this.dataSource.transaction(async (manager) => {
            const contentRepo = manager.getRepository(NodeContent);
            const exerciseRepo = manager.getRepository(Exercise);
            const content = await contentRepo.findOne({ where: { nodeId } });
            if (!content) throw new InternalServerErrorException('缺少 node_contents，无法写入练习题');
            await exerciseRepo.delete({ nodeContentId: content.id });
            await exerciseRepo.save(
              result.exercises.map((ex, index) =>
                exerciseRepo.create({
                  nodeContentId: content.id,
                  question: ex.question,
                  options: ex.options,
                  correctIndex: ex.correctIndex,
                  explanation: ex.explanation,
                  sortOrder: index,
                }),
              ),
            );
          });
        }
      }

      await this.tasks.markReady(nodeId, kind, {
        promptVersion: PromptManager.versionOf(this.stageOf(kind)),
      });
      return this.getArtifacts(nodeId, userId);
    } catch (err) {
      await this.tasks.markFailed(nodeId, kind, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }
```

`getArtifacts` 的状态派生（关键：兼容「无 task 行但内容存在」）：

```ts
  async getArtifacts(nodeId: string, userId: string): Promise<NodeArtifactsResponse> {
    await this.treeAccess.assertNodeOwner(nodeId, userId);
    const [tasks, content] = await Promise.all([
      this.tasks.findForNode(nodeId),
      this.loadContent(nodeId),
    ]);

    const viewOf = (kind: ArtifactKind, hasContent: boolean): ArtifactStatusView => {
      const task = tasks.find((t) => t.artifactKind === kind);
      return {
        status: task?.status ?? (hasContent ? GenerationTaskStatus.READY : GenerationTaskStatus.PENDING),
        attempts: task?.attempts ?? 0,
        lastError: task?.lastError ?? null,
      };
    };

    return {
      coreText: {
        ...viewOf(ArtifactKind.L3_CORE_TEXT, !!content?.coreText),
        text: content?.coreText ?? null,
      },
      codeExamples: {
        ...viewOf(ArtifactKind.L3_CODE_EXAMPLES, (content?.codeExamples?.length ?? 0) > 0),
        items: (content?.codeExamples ?? []).map((c) => ({
          title: c.title, language: c.language, code: c.code,
        })),
      },
      exercises: {
        ...viewOf(ArtifactKind.L3_EXERCISES, (content?.exercises?.length ?? 0) > 0),
        items: (content?.exercises ?? []).map((e) => ({
          question: e.question, options: e.options,
          correctIndex: e.correctIndex, explanation: e.explanation,
        })),
      },
    };
  }

  private stageOf(kind: ArtifactKind): PromptStage {
    switch (kind) {
      case ArtifactKind.L3_CORE_TEXT: return 'l3-core-text';
      case ArtifactKind.L3_CODE_EXAMPLES: return 'l3-code-examples';
      default: return 'l3-exercises';
    }
  }
```

> 注意 `ensureCoreText` 里递归调用 `generateArtifact` 时，coreText 的 claim 会成功（若已是 READY 则
> `generateArtifact` 立即返回，随后 `loadContent` 仍取到 coreText ✓；若 READY 但内容缺失则抛错 —— 这是
> 有意的：宁可显式失败，也不要静默产出不一致状态）。

- [ ] **Step 3: 跑测试确认通过**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/content/artifact
```
Expected: PASS（7 用例）

- [ ] **Step 4: `ContentService` 与新服务分工**

`content.service.ts`：
- `generateContent(nodeId, userId)` 改为委托语义「确保 coreText」：注入 `ArtifactService`，
  实现为 `await this.artifactService.generateArtifact(nodeId, userId, ArtifactKind.L3_CORE_TEXT)` 后返回 `loadContent(nodeId)`
- 删除 `generateContent` 内的 AI 调用与三表写入（已移入 ArtifactService）
- `getContentByNodeId` 保持返回 `NodeContent | null`（纯内容），**状态由 `/artifacts` 提供**

`content.module.ts`：`TypeOrmModule.forFeature([... , GenerationTask])`，并把 `GenerationTaskService`、
`ArtifactService` 加入 providers（`ArtifactService` 需 exports 以便 controller 注入）。

- [ ] **Step 5: 全量测试 + 类型检查 + 启动烟测**

```powershell
cd apps/api
node_modules\.bin\tsc --noEmit
node_modules\.bin\jest --runInBand
```
Expected: 全绿

```powershell
$p = Start-Process -FilePath "node_modules\.bin\nest.cmd" -ArgumentList "start" -WorkingDirectory (Get-Location) -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\p4t4-out.log" -RedirectStandardError "$env:TEMP\p4t4-err.log"
for ($i = 0; $i -lt 40; $i++) { Start-Sleep -Seconds 3; if ((Get-Content "$env:TEMP\p4t4-out.log" -ErrorAction SilentlyContinue | Select-String -Pattern "API running on" -Quiet) -or $p.HasExited) { break } }
if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force }
```
Expected: 启动成功（本 Task 改了 DI，必须验）

- [ ] **Step 6: 提交**

```powershell
git add apps/api/src/modules/content
git commit -m "✨ feat: ArtifactService 产物编排（幂等认领 + coreText 前置 + 单事务落库 + 状态标记）"
```

---

## Task 5: 接口层（新增产物接口 + legacy 端点语义收窄）

**Files:**
- Modify: `apps/api/src/modules/content/content.controller.ts`
- （不新建文件：`:kind` 用 `ParseEnumPipe` 校验，见 Step 1）
- 本 Task 不动前端（Task 6/7 处理）

**Interfaces:**
- Produces:
  - `GET /api/nodes/:id/artifacts` → `NodeArtifactsResponse`
  - `POST /api/nodes/:id/artifacts/:kind/generate` → `NodeArtifactsResponse`（`kind` ∈ `L3_CORE_TEXT` | `L3_CODE_EXAMPLES` | `L3_EXERCISES`）
  - `POST /api/nodes/:id/content` → 语义收窄为「确保 coreText」，响应形状不变（向后兼容）
  - `GET /api/nodes/:id/content` → 响应**新增** `artifacts` 字段（三类状态），其余字段不变

- [ ] **Step 1: 决定 `:kind` 的校验方式（推荐 `ParseEnumPipe`，无需新建文件）**

NestJS 的 `@Param()` 不会自动套用 DTO 校验，用 `ParseEnumPipe` 最直接（非法 kind → 自动 400）：

```ts
@Param('kind', new ParseEnumPipe(ArtifactKind)) kind: ArtifactKind
```

> 备选：新建 `dto/generate-artifact.dto.ts`（`@IsEnum(ArtifactKind)`）并用 `@Param() params: GenerateArtifactParamsDto`
> 配合全局 ValidationPipe。两种都可行；**本计划采用 `ParseEnumPipe`**，因此不新建 DTO 文件。

- [ ] **Step 2: 改控制器**

`content.controller.ts`：

```ts
import { ParseEnumPipe } from '@nestjs/common';
import { ArtifactKind } from '@skill/shared';
import { ArtifactService } from './artifact.service';

  /** 三类产物的状态 + 已就绪内容（前端分块渲染依据） */
  @UseGuards(JwtAuthGuard)
  @Get('artifacts')
  async getArtifacts(
    @Request() req: { user: { userId: string } },
    @Param('id') nodeId: string,
  ) {
    return this.artifactService.getArtifacts(nodeId, req.user.userId);
  }

  /** 生成某一类产物（幂等：已就绪或他人生成中会直接返回当前状态） */
  @UseGuards(JwtAuthGuard)
  @Post('artifacts/:kind/generate')
  async generateArtifact(
    @Request() req: { user: { userId: string } },
    @Param('id') nodeId: string,
    @Param('kind', new ParseEnumPipe(ArtifactKind)) kind: ArtifactKind,
  ) {
    return this.artifactService.generateArtifact(nodeId, req.user.userId, kind);
  }
```

> 注意 `@Controller('nodes/:id/content')` 的路由前缀会让新接口变成
> `nodes/:id/content/artifacts`。**要么把新接口放到一个独立的 `@Controller('nodes/:id')`**，
> 要么把控制器前缀改成 `nodes/:id` 并给旧方法加 `content` 路径。**推荐后者**，改动最小且路径符合设计文档：

```ts
@Controller('nodes/:id')
export class ContentController {
  // 旧接口保留原路径
  @Get('content') ...
  @Post('content') ...
  @Patch('content') ...
  // 新接口
  @Get('artifacts') ...
  @Post('artifacts/:kind/generate') ...
}
```

- [ ] **Step 3: `POST /content` 收窄 + `GET /content` 附状态**

- `POST /content` → `await this.contentService.generateContent(nodeId, userId)`，其中
  `generateContent` 现在只保证 coreText（Task 4 已改造）；响应仍用 `toResponse()` 映射，形状不变。
- `GET /content` → 在 `toResponse(content)` 基础上附加产物状态：
  ```ts
  const artifacts = await this.artifactService.getArtifacts(nodeId, userId);
  return { ...this.toResponse(content), artifacts };
  ```
  （`content` 为 null 时保持返回 null，不额外查询）

- [ ] **Step 4: 手工验证四条路径（真实库 + mock provider 更快）**

```powershell
$env:PNPM_HOME = Join-Path (Get-Location) ".pnpm-home"
# 用 mock provider 避免消耗真实 token：临时把 AI_PROVIDER 设为 mock 启动
$env:AI_PROVIDER = 'mock'
$p = Start-Process -FilePath "apps\api\node_modules\.bin\nest.cmd" -ArgumentList "start" -WorkingDirectory "apps\api" -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\p4t5-out.log" -RedirectStandardError "$env:TEMP\p4t5-err.log"
for ($i = 0; $i -lt 40; $i++) { Start-Sleep -Seconds 3; if ((Get-Content "$env:TEMP\p4t5-out.log" -ErrorAction SilentlyContinue | Select-String -Pattern "API running on" -Quiet) -or $p.HasExited) { break } }
```

验证清单（用 curl 或临时脚本）：

| # | 请求 | 期望 |
|---|---|---|
| 1 | `GET /api/nodes/:l2/artifacts` | 200，三类状态均为 `PENDING`，内容为空 |
| 2 | `POST /api/nodes/:l2/artifacts/L3_CORE_TEXT/generate` | 200，`coreText.status = READY` 且 `text` 非空 |
| 3 | 再次 `POST .../L3_CORE_TEXT/generate` | 200 且**内容不变**（幂等，不重复调 AI） |
| 4 | `POST /api/nodes/:l2/artifacts/L3_CODE_EXAMPLES/generate` | 200，`codeExamples.status = READY`；DB 中 `code_examples` 有行 |
| 5 | `POST /api/nodes/:l2/artifacts/L3_EXERCISES/generate` | 200；DB 中 `exercises` 有行 |
| 6 | `POST /api/nodes/:l2/artifacts/NOT_A_KIND/generate` | **400**（ParseEnumPipe 拦住） |
| 7 | `POST /api/nodes/:l2/content`（legacy） | 200；等价于「确保 coreText」 |
| 8 | `GET /api/nodes/:l2/content`（legacy） | 200，含 `coreText/codeExamples/exercises` + 新增 `artifacts` 字段 |
| 9 | 用另一账号访问 1–5 | 全部 **403** |

- [ ] **Step 5: 全量测试 + 提交**

```powershell
cd apps/api; node_modules\.bin\tsc --noEmit; node_modules\.bin\jest --runInBand
git add apps/api/src/modules/content
git commit -m "✨ feat: 产物接口（GET /artifacts + POST /artifacts/:kind/generate），legacy 内容端点收窄并附状态"
```

---

## Task 6: 前端状态层（产物状态驱动）

**Files:**
- Modify: `apps/web/composables/useSkillTreePage.ts`
- Modify: `apps/web/composables/useTreeLayout.ts`

**Interfaces:**
- `useTreeLayout.buildFlowElements(tree, nodes, childrenByL1, contentReadyByNodeId: Record<string, boolean>, options)`
  （第 4 参由 `contents: Record<string, FlowContent>` 改为 `contentReadyByNodeId`）
- `useSkillTreePage` 对外暴露：
  - `artifactsByNodeId: Ref<Record<string, NodeArtifactsResponse>>`
  - `ensureCoreText(nodeId): Promise<void>`（打开面板时调用；ready 后自动后台预取代码示例）
  - `generateExercises(nodeId): Promise<void>`（切到练习题 tab 时调用）
  - `retryArtifact(nodeId, kind)`（失败重试）

- [ ] **Step 1: 改 `useTreeLayout` 的 `hasContent` 依据**

- 删除 `FlowContent` / `FlowContentData` 的 `contents` 用法，`buildFlowElements` 第 4 参改为：

```ts
export function buildFlowElements(
  tree: FlowSkillTree,
  nodes: FlowTreeNode[],
  childrenByL1: Record<string, FlowTreeNode[]>,
  contentReadyByNodeId: Record<string, boolean>,
  options?: { collapsedL1Ids?: Set<string>; loadingNodeId?: string | null },
): { nodes: FlowNode[]; edges: Edge[] } {
```
并把 L2 节点数据里的 `hasContent: !!contents[l2.id]` 改为 `hasContent: !!contentReadyByNodeId[l2.id]`。

> `FlowContentData` / `FlowContent` 类型仍被 `L3Content.vue` 使用，保留不动。

- [ ] **Step 2: 重写 `useSkillTreePage` 的内容状态**

关键改动（其余保持）：

```ts
import { ArtifactKind, GenerationTaskStatus } from '@skill/shared';
import type { NodeArtifactsResponse } from '@skill/shared';

  const artifactsByNodeId = ref<Record<string, NodeArtifactsResponse>>({});
  const contentReadyByNodeId = computed<Record<string, boolean>>(() =>
    Object.fromEntries(
      Object.entries(artifactsByNodeId.value).map(([id, a]) => [
        id,
        a.coreText.status === GenerationTaskStatus.READY && !!a.coreText.text,
      ]),
    ),
  );

  const selectedArtifacts = computed(() =>
    selectedL2Id.value ? artifactsByNodeId.value[selectedL2Id.value] ?? null : null,
  );

  function storeArtifacts(nodeId: string, view: NodeArtifactsResponse) {
    artifactsByNodeId.value = { ...artifactsByNodeId.value, [nodeId]: view };
  }

  async function loadArtifacts(nodeId: string): Promise<NodeArtifactsResponse | null> {
    try {
      const view = await api<NodeArtifactsResponse>(`/nodes/${nodeId}/artifacts`);
      storeArtifacts(nodeId, view);
      return view;
    } catch (err) {
      console.error('[useSkillTreePage] loadArtifacts failed', err);
      return null;
    }
  }

  /** 打开 L2 抽屉：拉状态 → 未就绪则生成 coreText → ready 后后台预取代码示例 */
  async function ensureCoreText(nodeId: string) {
    const view = await loadArtifacts(nodeId);
    if (!view) return;
    if (view.coreText.status === GenerationTaskStatus.READY) {
      prefetchCodeExamples(nodeId);
      return;
    }
    loadingNodeId.value = nodeId;
    try {
      const next = await api<NodeArtifactsResponse>(`/nodes/${nodeId}/artifacts/L3_CORE_TEXT/generate`, {
        method: 'POST',
      });
      storeArtifacts(nodeId, next);
      toast.success('学习内容已生成');
      prefetchCodeExamples(nodeId);
    } finally {
      loadingNodeId.value = null;
    }
  }

  /** 后台预取代码示例：不阻塞、失败静默（用户切到该 tab 时还能手动重试） */
  function prefetchCodeExamples(nodeId: string) {
    void api<NodeArtifactsResponse>(`/nodes/${nodeId}/artifacts/L3_CODE_EXAMPLES/generate`, {
      method: 'POST',
    })
      .then((next) => storeArtifacts(nodeId, next))
      .catch(() => undefined);
  }

  /** 练习题按需生成（用户切到「练习题」tab 时触发） */
  async function generateExercises(nodeId: string) {
    const next = await api<NodeArtifactsResponse>(`/nodes/${nodeId}/artifacts/L3_EXERCISES/generate`, {
      method: 'POST',
    });
    storeArtifacts(nodeId, next);
  }

  async function retryArtifact(nodeId: string, kind: ArtifactKind) {
    try {
      const next = await api<NodeArtifactsResponse>(`/nodes/${nodeId}/artifacts/${kind}/generate`, {
        method: 'POST',
      });
      storeArtifacts(nodeId, next);
      toast.success('已重新生成');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成失败');
    }
  }
```

- `loadTreeData` 里把原来的 `loadExistingContents(l2Ids)`（逐个 GET /content）替换为
  **一次性拉取每棵 L2 的 artifacts 状态**（仍可并行），用于决定节点上显示「分析」还是「详情」：

```ts
    if (l2Ids.length > 0) {
      await Promise.all(l2Ids.map((id) => loadArtifacts(id)));
    }
```
- `generateContent` / `onNodeAction` 的 `'generate'` / `'open'` 分支改为：`analyze` → `ensureCoreText`
- `rebuildGraph()` 里把 `contents.value` 换成 `contentReadyByNodeId.value`
- 返回值里：移除 `contents` / `selectedL2Content` / `generateContent`，改为
  `artifactsByNodeId` / `selectedArtifacts` / `ensureCoreText` / `generateExercises` / `retryArtifact`

- [ ] **Step 3: 类型检查**

```powershell
cd apps/web; node_modules\.bin\nuxt typecheck
```
Expected: 此时会报 `tree.vue` / `L2ContentPanel` 的 props 不匹配 —— Task 7 修复

- [ ] **Step 4: 提交（与 Task 7 一并提交更合适）**

> 由于 Task 6 单独提交会让前端无法编译，**Task 6 与 Task 7 合并为一个提交**（与阶段 1 的 T11+T12 同理）。

---

## Task 7: 前端渲染（分块状态 + 重试 + 按需）

**Files:**
- Create: `apps/web/components/tree/ArtifactStateHint.vue`
- Modify: `apps/web/components/tree/L2ContentPanel.vue`
- Modify: `apps/web/components/tree/L3Content.vue`
- Modify: `apps/web/pages/skills/[id]/tree.vue`

**Interfaces:**
- `L2ContentPanel` props：`artifacts: NodeArtifactsResponse | null`、`loading?: boolean`、`nodeId`、`learningStatus`
- emits：`close`、`status-change`、`retry-artifact(nodeId, kind)`、`request-exercises(nodeId)`

- [ ] **Step 1: 新建状态提示组件**

`ArtifactStateHint.vue`（三种非就绪状态：生成中 / 失败 / 合法空）：

```vue
<template>
  <div v-if="status === GenerationTaskStatus.FAILED" class="rounded-[9.6px] border border-border p-5">
    <p class="mb-3 text-[14px] text-danger">生成失败：{{ lastError || '未知原因' }}</p>
    <button
      type="button"
      class="rounded-[9.6px] border border-border bg-surface px-4 py-1.5 text-[13px] text-ink transition-colors hover:bg-elevated"
      @click="emit('retry')"
    >
      重试
    </button>
  </div>

  <div
    v-else-if="status === GenerationTaskStatus.GENERATING || status === GenerationTaskStatus.PENDING"
    class="rounded-[9.6px] border border-dashed border-border p-5 text-[13px] text-muted"
  >
    {{ pendingText }}
  </div>

  <EmptyState v-else :title="emptyTitle" :description="emptyDescription" />
</template>

<script setup lang="ts">
import { GenerationTaskStatus } from '@skill/shared';

withDefaults(
  defineProps<{
    status: GenerationTaskStatus;
    lastError?: string | null;
    pendingText?: string;
    emptyTitle?: string;
    emptyDescription?: string;
  }>(),
  {
    lastError: null,
    pendingText: '正在生成…',
    emptyTitle: '暂无内容',
    emptyDescription: '',
  },
);

const emit = defineEmits<{ (e: 'retry'): void }>();
</script>
```

- [ ] **Step 2: `L2ContentPanel` 改为透传产物**

- props：`content: FlowContentData` → `artifacts: NodeArtifactsResponse | null`
- 移除整块 `loading` 全屏 spinner（改为各区块自己的状态）
- 模板里**不要写 `nodeId!` 这类 TS 非空断言**（Vue 模板表达式不支持）；改用脚本里的具名函数：
```ts
function onRetry(kind: ArtifactKind) {
  if (props.nodeId) emit('retry-artifact', props.nodeId, kind);
}

function onRequestExercises() {
  if (props.nodeId) emit('request-exercises', props.nodeId);
}
```
- 把 `TreeL3Content` 的调用改为：

```vue
      <TreeL3Content
        v-else-if="artifacts"
        :artifacts="artifacts"
        :active-tab="activeTab"
        @retry="onRetry"
        @request-exercises="onRequestExercises"
      />
```

- 切到 `exercise` tab 时按需生成：
```ts
watch(activeTab, (tab) => {
  if (tab !== 'exercise' || !props.artifacts || !props.nodeId) return;
  const status = props.artifacts.exercises.status;
  if (status === GenerationTaskStatus.PENDING || status === GenerationTaskStatus.FAILED) {
    emit('request-exercises', props.nodeId);
  }
});
```

- 同时把 header/footer 保持不动（学习状态按钮组不变）

- [ ] **Step 3: `L3Content` 按产物状态分块渲染**

props 改为 `artifacts: NodeArtifactsResponse`，每个 section 用 `ArtifactStateHint`：

```vue
    <!-- Concept -->
    <section v-if="activeTab === 'concept' || !activeTab">
      <article v-if="coreReady" class="prose prose-skill max-w-none" v-html="renderedCoreText" />
      <TreeArtifactStateHint
        v-else
        :status="artifacts.coreText.status"
        :last-error="artifacts.coreText.lastError"
        pending-text="正在生成核心内容…"
        @retry="emit('retry', 'L3_CORE_TEXT')"
      />
    </section>

    <!-- Code examples -->
    <section v-if="activeTab === 'code' || !activeTab">
      <div v-if="artifacts.codeExamples.items.length" class="space-y-6">…（原渲染逻辑不变，数据源换成 artifacts.codeExamples.items）…</div>
      <TreeArtifactStateHint
        v-else
        :status="artifacts.codeExamples.status"
        :last-error="artifacts.codeExamples.lastError"
        pending-text="正在生成代码示例…"
        empty-title="该主题无代码示例"
        empty-description="纯概念性主题不提供代码演示。"
        @retry="emit('retry', 'L3_CODE_EXAMPLES')"
      />
    </section>

    <!-- Exercises -->
    <section v-if="activeTab === 'exercise' || !activeTab">
      <div v-if="artifacts.exercises.items.length" class="space-y-5">…（原渲染逻辑不变）…</div>
      <TreeArtifactStateHint
        v-else
        :status="artifacts.exercises.status"
        :last-error="artifacts.exercises.lastError"
        pending-text="正在出题…"
        empty-title="暂无练习题"
        @retry="emit('retry', 'L3_EXERCISES')"
      />
    </section>
```

- `tabs` 的显示条件改为 `artifacts.codeExamples.status === READY && items.length > 0`（避免生成中就冒出空 tab）

- [ ] **Step 4: `tree.vue` 接线**

```vue
          <TreeL2ContentPanel
            :title="selectedL2Title"
            :artifacts="selectedArtifacts"
            :loading="loadingNodeId === selectedL2Id"
            :node-id="selectedL2Id"
            :learning-status="selectedL2Id ? learningStatusByNodeId[selectedL2Id] : undefined"
            @close="selectedL2Id = null"
            @status-change="handleStatusChange"
            @retry-artifact="retryArtifact"
            @request-exercises="generateExercises"
          />
```
并在解构里把 `selectedL2Content` / `generateContent` 换成 `selectedArtifacts` / `retryArtifact` / `generateExercises`；
打开抽屉的地方（`onNodeAction` 的 `'open'`）在 `useSkillTreePage` 内部已改为 `ensureCoreText`。

- [ ] **Step 5: 类型检查 + 手工验证**

```powershell
cd apps/web; node_modules\.bin\nuxt typecheck
```
Expected: exit 0

手工验证（mock provider，起 API + Web）：
- 打开一个未生成内容的 L2 → 概念 tab 显示「正在生成核心内容…」，随后出现正文
- 正文出现后切到「代码演示」→ 已就绪（后台已预取）或显示生成中
- 切到「练习题」→ 触发按需生成并出现题目
- 断网/让 AI 失败后（可临时把 AI_PROVIDER 指向不存在的地址）→ 对应区块显示「生成失败 + 重试」，
  重试成功后恢复
- 未生成内容的 L2 在图上按钮显示「分析」；生成后显示「详情」

- [ ] **Step 6: 提交（与 Task 6 合并）**

```powershell
git add apps/web
git commit -m "✨ feat: 前端分块加载产物（coreText 阻塞 / 代码示例预取 / 练习题按需 + 失败重试）"
```

---

## Task 8: 真实 AI 端到端验证

**Files:**
- Create: `docs/plans/2026-09-16-phase4-verification.md`（Task 9 完善）

**Interfaces:**
- Consumes: 前 7 个 Task 的全部产出

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
cd ../../apps/web
node_modules\.bin\nuxt typecheck
```
Expected: 全绿

- [ ] **Step 2: 真实 AI 端到端（临时脚本，验证后删除）**

脚本要覆盖：

| # | 验证项 | 期望 |
|---|---|---|
| 1 | 建树 → 展开 L2（真实 AI，沿用阶段 3 的路径） | 成功 |
| 2 | `GET /nodes/:l2/artifacts` | 三类状态均 `PENDING` |
| 3 | `POST .../L3_CORE_TEXT/generate` | `coreText.status=READY`；`generation_tasks` 该行 `status=READY`、`attempts=1`、`prompt_version=1.0.0` |
| 4 | **再 POST 一次 coreText** | 内容不变、`attempts` 仍为 1（认领失败直接返回 → **证明幂等**） |
| 5 | `POST .../L3_CODE_EXAMPLES/generate` | `codeExamples.status=READY`；`code_examples` 有行；审计含 `l3-code-examples` |
| 6 | `POST .../L3_EXERCISES/generate` | `exercises.status=READY`；`exercises` 有行；审计含 `l3-exercises` |
| 7 | 三个产物的 `ai_generations` 行 | 各自主张的 prompt 且 `parsed_ok=true` |
| 8 | **前置依赖**：新开一个 L2，直接 POST `L3_EXERCISES`（不先生成 coreText） | 成功；且审计里**先出现 `l3-core-text` 再出现 `l3-exercises`** |
| 9 | **失败标记**：临时把 `AI_API_KEY` 置空重启，POST 生成 | 500；`generation_tasks.status=FAILED` 且 `last_error` 非空 |
| 10 | 恢复 key 后再次 POST | 成功；`attempts=2`（FAILED 可重认领） |
| 11 | 越权：B 账号 `GET /nodes/:l2/artifacts` | 403 |
| 12 | 清理 E2E 用户与树 | 无残留（`generation_tasks` 随节点级联删除；`ai_generations` 留存且外键 SET NULL） |

其中第 9/10 项需要在脚本外重启服务（改环境变量），可拆成两段：先跑 1–8、11、12，再单独验 9、10。

- [ ] **Step 3: 前端手工验证记录**

按 Task 7 Step 5 的清单走一遍，把结果（含截图描述）记入验证文档。

---

## Task 9: 阶段 4 收尾

**Files:**
- Create: `docs/plans/2026-09-16-phase4-verification.md`

- [ ] **Step 1: 写验证文档**

结构参照 `docs/plans/2026-09-16-phase3-verification.md`：验证矩阵、真实端到端 12 项、
前端手工验证、执行偏差、遗留事项（交给阶段 5：过期→重新生成）。

- [ ] **Step 2: 阶段 4 收尾提交**

```powershell
git add docs/plans
git commit -m "📃 docs: 阶段 4 验证记录（产物状态机 + stage 拆分 + 前端分块）"
```

---

## Self-Review 结果

**规格覆盖（对照设计文档第 4 节与第 6 节）**

| 设计条目 | 覆盖任务 |
|---|---|
| 4.1 两层模型（generation_tasks 意图/状态 vs ai_generations 执行/审计） | Task 3（状态机）+ 阶段 3 已有 `ai_generations` |
| 4.2 `generateL3` 拆三个 stage，各自落库目标 | Task 1（契约）+ Task 4（落库） |
| 4.3 生成时机配对（coreText 阻塞 / 代码示例预取 / 练习题按需） | Task 6（状态层）+ Task 7（渲染与触发） |
| 4.4 并发与幂等（ON CONFLICT 抢行、120s 超时重认领、替代内存 Map） | Task 3 |
| 6.1 新增 `/artifacts` 与 `/artifacts/:kind/generate` | Task 5 |
| 6.2 `POST /content` 收窄 + `GET /content` 保持兼容 | Task 5 |
| 6.3 前端分块 + shared 类型同步 | Task 2、6、7 |

**对设计文档的两处有意偏离（已在正文说明理由）**
1. **练习题改为「切到该 tab 时生成」**，而非「读完后后台预取」——后者需要追踪阅读进度，
   复杂度与收益不匹配；按需生成同样满足「生成时机跟随消费时机」。
2. **`l3-code-examples` / `l3-exercises` 的输入强制包含 `coreText`**，并把它作为**前置依赖**在服务层保证。
   设计文档第 1.2 节把「复用已有输入」列为暂不做，但「让示例/题目与已生成的核心内容一致」是拆分后
   保持内容连贯的必要条件，而不是可选的增强，故本轮纳入。

**占位符扫描**：无 TBD/TODO。所有代码块均为最终形态；SQL、状态阈值（120s）、错误摘要截断（1000 字）
均为确定值。Task 5 Step 1 的 DTO 方案给出了取舍（推荐 `ParseEnumPipe`，文件可不建），已明确标注。

**类型一致性核对**
- `ArtifactKind` / `GenerationTaskStatus` 来自 `@skill/shared`（阶段 1 已定义）✓
- `GenerationTaskService.claim/markReady/markFailed/findForNode` 在 Task 3 定义，Task 4 按此调用 ✓
- `generateL3CoreText/generateL3CodeExamples/generateL3Exercises` 在 Task 1 定义，Task 4 按此调用 ✓
- `NodeArtifactsResponse` 在 Task 2 定义，Task 4/5/6/7 均按此消费 ✓
- `buildFlowElements` 第 4 参在 Task 6 Step 1 改为 `contentReadyByNodeId`，同 Task Step 2 的调用点同步 ✓

**已知顺序约束（不要打乱）**
1. Task 1 必须先于 Task 4（三个新 stage 是编排的前提）
2. Task 2 必须先于 Task 4（`NodeArtifactsResponse` 是返回类型）
3. Task 3 必须先于 Task 4（编排依赖认领）
4. Task 6 与 Task 7 **必须同一个提交**（单独提交会让前端无法编译）
5. Task 5 的控制器前缀调整会影响旧路径，务必按 Step 2 的 `@Controller('nodes/:id')` 方案改，否则新路径会变成 `nodes/:id/content/artifacts`

**风险与回退**

| 风险 | 应对 |
|---|---|
| 三个 stage 拆分后 prompt 变多，总 token 上升 | 这是设计文档 2.2 已确认的取舍（换来边界清晰与局部失败可恢复）；`ai_generations` 可按 stage 统计成本 |
| 预取会在用户没看代码示例时也消耗 token | 预取只发生在 coreText 就绪后；若成本敏感，把 `prefetchCodeExamples` 改为仅在切到 code tab 时触发（一处改动） |
| `generation_tasks` 与业务表可能不一致（READY 但内容被删） | `getArtifacts` 以「内容是否存在」兜底判定 READY/PENDING；Task 4 Step 2 的注释里已说明「READY 但内容缺失」会显式抛错 |
| 控制器前缀改动影响既有前端调用 | 旧路径 `nodes/:id/content` 保持不变（只是从 `@Controller` 前缀移到方法路径），Task 5 验证清单第 7/8 项专门覆盖 |
| 前端分块改动面较大 | Task 7 Step 5 的手工清单覆盖「未生成 → 生成中 → 就绪 → 失败重试」四个状态 |

---

## Execution Handoff

计划已保存到 `docs/plans/2026-09-16-phase4-artifact-pipeline.md`。两种执行方式：

**1. Subagent-Driven** —— 每个 Task 派全新 subagent，任务间两阶段评审。

**2. Inline Execution** —— 当前会话按批次执行，带检查点。

**我建议 Inline**（与阶段 1–3 一致）：Task 之间有硬顺序依赖、共用同一个数据库与 `.env`，
且 Task 5 会调整控制器路由、Task 6/7 必须同提交——这种"中间态必然存在"的改造更适合单会话推进；
另外本阶段要真实跑通 AI 与前端交互，inline 更容易在发现问题时就地修复。
