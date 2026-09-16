# 计划 B（阶段 3：AI 契约层）验证记录与执行偏差

> **日期**：2026-09-16
> **分支**：`feat/ai-contract-layer`
> **依据计划**：`docs/plans/2026-09-16-phase3-ai-contract-layer.md`
> **依据设计**：`docs/specs/2026-09-16-ai-contract-and-dataflow-design.md`（第 3 节）
> **提交范围**：`5af6427`（T1）→ T8 收尾，共 9 个提交

---

## 一、验证矩阵

| 层次 | 手段 | 结果 |
|---|---|---|
| 契约基座自检 | `ts-node src/prompt-engine.selfcheck.ts` | **SELFCHECK OK**（15 条断言） |
| 注册表自检 | `ts-node src/prompt-manager.selfcheck.ts` | **SELFCHECK OK**（7 条） |
| 9 个 stage 契约自检 | `ts-node src/stages.selfcheck.ts` | **SELFCHECK OK**（34 条，含各 stage 正例/反例与跨字段不变量） |
| mock 契约一致性 | 9 个 stage 经 `build → MockProvider.chat → parse` 全跑 | **MOCK CONTRACT OK**（9/9） |
| 单元测试 | `jest --runInBand` | **15 suites / 71 tests 全绿**（阶段开始时 11 suites / 57 tests） |
| 类型检查 | 两侧 `tsc --noEmit` | exit 0 |
| 应用启动 | `nest start` + 真实库 | 启动成功（本阶段三次改动 DI，均单独验过） |
| 结构断言 | `ts-node scripts/verify-schema.ts` | **SCHEMA OK**（阶段 1 的 24 项断言未回归） |
| **真实 AI 端到端** | 真实 DeepSeek 调用 + 真实库 | **23 / 23 通过**（见第二节） |

---

## 二、真实 AI 端到端结果（23 项全过）

用真实 DeepSeek（`AI_PROVIDER=deepseek`、`AI_MODEL=deepseek-v4-flash`）跑完整用户路径：

| # | 验证项 | 实测 |
|---|---|---|
| 1 | 注册 | 201 |
| 2 | 真实建树（AI 生成 L1） | 201，**8 个 L1 节点** |
| 3 | owner_id + 学习记录 | 均正确写入 |
| 4 | `ai_generations` 落库 | stage=`l1-outline`、parsed_ok=true、prompt_version=`2.0.0`、**attempt=1** |
| 5 | latency / request_hash | **3735ms**、sha1 前 40 位非空 |
| 6 | provider / model | deepseek / deepseek-flash |
| 7 | **`tree_id` 为 null** | 确认无误 —— 建树的 AI 调用发生在树落库**之前**（先算后落库的直接体现），审计行只关联 user_id |
| 8 | 问卷题目 | 8 题，每条都有 id |
| 9 | **非法载荷前置拒绝** | 缺 `questionId` 的提交 → **400，且 portrait 审计数为 0**（未消耗 AI 调用） |
| 10 | 真实肖像生成 | 201；`computed_portrait` 形状完整（identityTags=3） |
| 11 | `portrait_schema_version` | `2.0.0`（取自 `PromptManager.versionOf('portrait')`，非硬编码） |
| 12 | 真实展开 L2 | 201，6 个 L2 |
| 13 | 真实生成 L3 | 201 |
| 14 | **单事务三表同写** | `node_contents=1`、`code_examples=2`、`exercises=6` —— 一次调用后三表齐活 |
| 15 | 审计关联 node | `l3-content` 行带 node_id |
| 16 | **token 用量** | l1-outline 499+763 / l2-nodes 518+403 / l3-content 1061+3369 / portrait 747+76 |
| 17 | 契约通过率 | 4 个 stage 全部 `bool_and(parsed_ok)=true`，**无一次 schema_mismatch**（即无重试） |
| 18 | 级联清理 | 删用户后 users/trees/nodes 残留均为 0 |
| 19 | **审计留存 + SET NULL** | 8 条审计记录全部保留，`user_id` 已置 null（业务数据删除不影响审计） |

**结论**：契约层在真实模型上零失败；「先算后落库」与审计链路均按设计工作；token 用量已可用于成本统计。

---

## 三、执行偏差记录

### 3.1 计划片段有缺陷（实现时修正）

| # | 计划写法 | 问题 | 实际处理 |
|---|---|---|---|
| 1 | packages 侧自检用 `..\..\node_modules\.bin\ts-node` | 根 `node_modules/.bin` 只有 `tsc`；ts-node/jest 都装在 apps/api（pnpm 严格隔离） | 改为 `..\..\apps\api\node_modules\.bin\ts-node`，并回写进计划 |
| 2 | T1 就把 `PromptTemplate.schema` 设为必填 | 9 个 stage 到 T3/T4 才迁移，T1~T3 期间编译不过 | 迁移期设为可选，T4 收口为必填（保证每个提交可编译） |
| 3 | `StageOutput` 用 `z.infer<schema>` 或 `extends PromptTemplate<unknown, infer O>` | 前者在 schema 可选时无法编译；后者因 build 入参处于**逆变位置**而恒为 `never`（已实测） | 改用 `ReturnType<模板['parse']>` |
| 4 | 未提及要导出各 stage 的 Input/Output 接口 | `PROMPT_TEMPLATES` 的推断类型引用它们，本包 `declaration: true` 要产出 .d.ts → TS4023「cannot be named」 | 导出 7 个文件里的全部接口（T3/T4 重写时保持导出） |
| 5 | 安装 zod 用 `pnpm add zod@^4` | ① pnpm 需 spawn node 且管道捕获输出 → 沙箱 `EPERM`；② 覆盖 `PNPM_HOME` 会连带改默认 store → `ERR_PNPM_UNEXPECTED_STORE` | 对安装命令发起一次 `sandbox_permissions` 升级，并显式 `--store-dir "D:\.pnpm-store\v3"` |
| 6 | Task 8 未要求重建 dist | apps/api 运行时读 `packages/*/dist`，只跑 `tsc --noEmit` 会让 API 用旧提示词 | 每个 Task 结束都构建 prompt-manager / ai-provider 的 dist |
| 7 | mock 的 9 处 return 逐个包 `{ content }`（18 处改动） | 冗余 | 原方法体改名私有 `reply(prompt): string`，外层加薄 `chat` 包装（3 处改动） |
| 8 | Task 4 的 recommendations schema 用 `max(15)` | 与业务约束 `MAX_RECOMMENDATIONS=10` 不符 | 改为 `max(10)`，并把提示词里自相矛盾的「恰好 6-10 个」改为「6-10 个，最多不超过 10」 |
| 9 | 未提及 `SubmitPortraitDto` 的嵌套校验 | `answers` 只校验了「是数组」，**元素完全没校验** → 缺 `questionId` 的载荷一路走到数据库才报 NOT NULL，而那时 AI 已调用、token 已花 | 新增 `PortraitAnswerDto`（`@IsUUID` + `@IsString({each:true})`）与 `@ValidateNested({each:true})`；E2E 验证坏载荷 → 400 且 0 次 AI 调用 |

### 3.2 计划未列出但被契约层暴露的既有 bug

契约层的价值在这里直接体现 —— 它抓出了两处长期静默的不一致：

| # | 发现 | 影响 | 处理 |
|---|---|---|---|
| 10 | **mock 里根本没有 `knowledge-points` 分支** | stage 0 正文明写"再被你归纳成 L1 学习大纲"，prompt 一直被 L1 分支截胡、返回 `{nodes}` 而非 `{points}` → **mock 模式下知识点清单永远是空的**，被前端 `result.points \|\| []` 静默吞掉 | 在 L1/L2 分支之前补 Stage 0 分支（标记「知识点清单」） |
| 11 | **recommendations 的 6 条 mock 数据从来没有 `keywords`** | 提示词第 9 条一直要求 3-6 个关键词，实现从未提供 | 为 6 条各补 `keywords` |

### 3.3 执行事故（已完全恢复）

用 PowerShell `Get-Content -Raw` + 正则批量给 7 个模板文件加 `export`，**把文件写坏**：
控制台代码页是 GBK，读 UTF-8 得到乱码，模板字符串里的换行也丢失。
`git checkout -- packages/prompt-manager/src/templates` 完整恢复，随后改用 `edit` 工具逐个修改。

> **教训（已记入环境知识）**：本仓库**禁止用 PowerShell `Get-Content`/`Set-Content` 读写回环改文本文件**，
> 必须用 edit/write 工具（它们按 UTF-8 处理）。

### 3.4 一次脚本自身的误判（值得记，因为它揭示了设计语义）

首轮 E2E 有 3 项失败，原因是我的校验 SQL 按 `tree_id` 查 `l1-outline` 的审计行，
而**该行的 `tree_id` 必然是 null** —— 建树的 AI 调用发生在树落库之前（先算后落库）。
这不是缺陷而是设计的直接体现，现已把「tree_id 为 null」写成一条**正向断言**。

---

## 四、沙箱环境知识（新增）

1. **装依赖需要一次权限升级**：`pnpm add` 会 `spawnSync node --version` 并管道捕获输出（沙箱禁止 → `EPERM`），
   且要写工作区外的 store。做法：`$env:PNPM_HOME=<workspace>/.pnpm-home` +
   `pnpm add <pkg> --store-dir "D:\.pnpm-store\v3"` + 对该命令发起一次 `sandbox_permissions` 升级。
2. **zod 4.6.5 与 openai 的 peer 警告无害**：`openai@4.104.0` 声明 `zod@^3.23.8`，实际解析到 4.6.5。
   已核实 openai 主入口不在加载期 `require('zod')`，且 `packages/ai-provider/node_modules` 下没有 zod。
   **但禁止使用 `openai/helpers/zod`**（该入口需要 zod 3 API）。
3. **zod 的 `.meta({ description })` 会流入 `z.toJSONSchema`** —— 已实测（selfcheck 里有断言），
   因此注入提示词的格式段带中文字段说明，兼顾模型友好度与同源性。
4. **`Declaration: true` 的包导出聚合对象时，被引用类型必须可命名**：`PROMPT_TEMPLATES` 引用了
   各 stage 文件里的接口，未导出即报 TS4023。

---

## 五、遗留事项（交给阶段 4/5）

| 事项 | 归属 |
|---|---|
| `generateL3` 仍是「一次返回三个业务」的合并调用 | 阶段 4（拆成 `l3-core-text` / `l3-code-examples` / `l3-exercises`） |
| `generation_tasks` 表已建但尚无写入方 | 阶段 4（产物状态机 + 库级幂等） |
| interview 的内存去重 `Map` 仍保留 | 阶段 4（改用 `generation_tasks`，可跨实例/重启） |
| 前端仍一次性拉聚合内容（coreText + codeExamples + exercises） | 阶段 4（改为分块加载 + 后台预取） |
| 「过期 → 重新生成」流程缺失；`NodeContent.version` 在重新生成前恒为 1 | 阶段 5 |
| `*.selfcheck.ts` 也被编译进 dist | 清理候选（改 tsconfig exclude 或移到 scripts/） |
| `packages/shared/src/index.ts` 的显式具名导出列表需人工同步 | 清理候选 |
| `skill_trees.keywords` 只写不读；`tree_nodes.level` 枚举含未使用的 L3 | 清理候选 |
