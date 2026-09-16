# 计划 C（阶段 4：产物状态机与 stage 拆分）验证记录与执行偏差

> **日期**：2026-09-16
> **分支**：`feat/artifact-pipeline`（自 master `ece8c85` 切出）
> **依据计划**：`docs/plans/2026-09-16-phase4-artifact-pipeline.md`
> **依据设计**：`docs/specs/2026-09-16-ai-contract-and-dataflow-design.md`（第 4 节、第 6 节）
> **提交范围**：`3949f85`（T1）→ `1bffd31`（T7 修复），7 个提交；T9 为本文档提交
> **上线后补充**：`e92cd7d`（修复 2.5 节记录的并发缺陷）

---

## 一、验证矩阵

| 层次 | 手段 | 结果 |
|---|---|---|
| 契约基座自检 | `ts-node src/prompt-engine.selfcheck.ts` | **SELFCHECK OK**（15 条断言） |
| 注册表自检 | `ts-node src/prompt-manager.selfcheck.ts` | **SELFCHECK OK**（10 条，11 个 stage） |
| 11 个 stage 契约自检 | `ts-node src/stages.selfcheck.ts` | **SELFCHECK OK**（39 条，含三个新 stage 的正例/反例与跨字段不变量） |
| 状态机单测 | `jest generation-task.service.spec.ts` | **6/6 通过**（SQL 文本断言 + 陈旧阈值 + 标记语义） |
| 编排单测 | `jest artifact.service.spec.ts` | **8/8 通过**（幂等 / 前置依赖 / 失败标记 / 状态派生 / **并发等待**） |
| 全量单测 | `jest --runInBand` | **16 suites / 83 tests 全绿**（阶段开始时 15 suites / 71 tests；含 2.5 节补的并发用例） |
| 类型检查 | `apps/api` `tsc --noEmit` | exit 0 |
| 前端类型检查 | `apps/web` `nuxt typecheck` | exit 0 |
| 应用启动（DI） | `nest start` + 真实库 | 启动成功；本阶段 3 次改 DI，均单独验过（含路由表核对） |
| 结构断言 | `ts-node scripts/verify-schema.ts` | **SCHEMA OK**（阶段 1 的 24 项断言未回归） |
| 接口九路径（mock） | 真实库 + `AI_PROVIDER=mock` | **9 / 9 通过**（见 2.1） |
| **真实 AI 端到端** | 真实 DeepSeek + 真实库 | **12 / 12 通过**（见 2.2） |
| **浏览器 UI 验证** | `nuxt dev` + playwright-cli | 分块渲染 / 失败重试 / 按需生成全部实测（见 2.3） |
| 数据清理 | 删除全部验证用户 | 领域表残留 0，审计表留存 27 行且关联列已 SET NULL（见 2.4） |
| **上线后缺陷回归** | 真实操作发现 → 单测复现 → 真实 AI 并发复现 | **已修复**（见 2.5；`e92cd7d`） |
| **既有 UI 缺陷回归** | 真实操作发现 → 浏览器 DOM 断言 | **已修复**（见 2.6；`c182d95`，非阶段 4 引入） |

---

## 二、端到端实测结果

### 2.1 接口九路径（mock provider，无 token 消耗）

| # | 请求 | 期望 | 实测 |
|---|---|---|---|
| 1 | `GET /nodes/:l2/artifacts` | 三类状态 PENDING | 200，`core=PENDING codes=PENDING ex=PENDING` |
| 2 | `POST /artifacts/L3_CORE_TEXT/generate` | coreText READY | 201，READY，attempts=1，正文 197 字 |
| 3 | 再次 POST coreText | 幂等，内容不变 | 201，attempts **仍为 1**，正文逐字相同 |
| 4 | `POST /artifacts/L3_CODE_EXAMPLES/generate` | READY + 落库 | 201，READY，`code_examples` 1 行 |
| 5 | `POST /artifacts/L3_EXERCISES/generate` | READY + 落库 | 201，READY，`exercises` 2 行 |
| 6 | `POST /artifacts/NOT_A_KIND/generate` | 400 | **400**（`ParseEnumPipe` 拦住） |
| 7 | `POST /nodes/:l2/content`（legacy） | 200，等价「确保 coreText」 | 201，正文与 #2 一致，附带已就绪的示例与题目 |
| 8 | `GET /nodes/:l2/content`（legacy） | 附 `artifacts` 字段 | 200，`artifacts.coreText.status=READY` |
| 9 | B 账号访问 #1 / #5 | 403 | **403 / 403** |

数据库旁证：`generation_tasks` 三行 `READY / attempts=1 / prompt_version=1.0.0 / last_error is null`；
`ai_generations` 中 `l3-core-text` 只有 **1 行** —— 两次 POST 只花了一次 AI 调用，幂等成立。

### 2.2 真实 AI 端到端（12 项）

真实 DeepSeek（`AI_PROVIDER=deepseek`），建树 → 展开 L2 → 逐产物生成：

| # | 验证项 | 实测 |
|---|---|---|
| 1 | 真实建树 + 展开 L2 | 201；8 个 L1、每个 L1 展开 6 个 L2 |
| 2 | 新节点 `GET /artifacts` | 三类均 `PENDING`，内容为空 |
| 3 | `POST L3_CORE_TEXT/generate` | 201；coreText READY，**正文 954 字**；`generation_tasks` 行 `READY / attempts=1 / prompt_version=1.0.0` |
| 4 | 再 POST 一次 coreText | 201；内容逐字相同、`attempts` **仍为 1**（认领失败直接返回 → 幂等） |
| 5 | `POST L3_CODE_EXAMPLES/generate` | 201；READY，**3 个代码示例**；`code_examples` 3 行；审计含 `l3-code-examples` |
| 6 | `POST L3_EXERCISES/generate` | 201；READY，**6 道单选题**；`exercises` 6 行；审计含 `l3-exercises` |
| 7 | 三个 stage 的审计行 | 各 1 行、`parsed_ok=true`、prompt_version=1.0.0，**无一次重试** |
| 8 | **前置依赖**：新 L2 直接 POST `L3_EXERCISES` | 201；返回里 `coreText=READY`（自动前置生成）、`exercises=READY`、`codeExamples=PENDING`（未请求的不产生副作用）；审计按时间序为 `l3-core-text`(21:39:56) → `l3-exercises`(21:40:05) |
| 9 | **失败标记**：改用无效 key 重启后 POST | **500**；`generation_tasks.status=FAILED`、`attempts=1`、`last_error` 非空（`401 Authentication Fails…`）；审计 `error_kind=provider_error`、`parsed_ok=false` |
| 10 | 恢复 key 后再 POST | 201；`READY`、**`attempts=2`**、`last_error` 被清空、6 道题落库（FAILED 可重认领） |
| 11 | 越权：B 账号 `GET /artifacts` 与 `POST .../generate` | **403 / 403** |
| 12 | 清理 | 删 5 个验证用户后 `users/trees/tree_nodes/node_contents/code_examples/exercises/generation_tasks` 全为 0；`ai_generations` 留存 27 行且 `tree_id/node_id/user_id` 全为 NULL |

**成本观测（阶段 4 三个 stage，含上述全部真实调用）**：

| stage | 调用数 | prompt tokens | completion tokens | 平均耗时 |
|---|---|---|---|---|
| `l3-core-text` | 5 | 1 924 | 7 560 | 7 354 ms |
| `l3-code-examples` | 3 | 2 142 | 2 193 | 3 526 ms |
| `l3-exercises` | 6 | 4 754 | 6 017 | 5 096 ms |

拆分让「一次调用变三次」的 token 增量可直接按 stage 观测（设计文档 2.2 的既定取舍）。

### 2.3 浏览器 UI 验证（`nuxt dev` + playwright-cli，真实 AI）

| # | 场景 | 期望 | 实测 |
|---|---|---|---|
| 1 | 打开树页 | 前端按节点拉产物状态 | **12 次 `GET /nodes/:id/artifacts`** + 1 次 `/progress`，全部 200（旧 `/content` 聚合接口不再被调用） |
| 2 | 图上按钮门控 | 有 coreText → 「详情」；无 → 「分析」 | 3 个「详情」、10 个「分析」，与库中产物状态一致 |
| 3 | 打开「详情」抽屉 | 概念 tab 渲染 coreText | 真实 AI 正文（"什么是类型注解…"）以 Markdown 渲染 |
| 4 | 代码示例**失败**夹具（`status=FAILED` + 清空内容） | 显示失败与重试 | tab 列表 `[概念, 代码演示, 练习题]`；代码 tab 显示 **「生成失败：fixture: simulated AI timeout…」+「重试」按钮** |
| 5 | 点「重试」 | 重新调 AI 并渲染 | 点击后 `attempts` 2→3、`code_examples` 写入 3 行、`last_error` 清空、页面出现代码块 |
| 6 | 练习题 tab（已就绪） | 直接渲染题目 | 「第 1 题 …A/B/C/D 选项」 |
| 7 | 练习题**未就绪**夹具（`status=PENDING` + 清空题目） | 切 tab 触发按需生成 | 切入即发 `POST .../artifacts/L3_EXERCISES/generate` → 201，题目随即渲染 |
| 8 | coreText 未就绪夹具 | 图上退回「分析」，点击后生成 | 「详情」3→2、「分析」10→11；点击「分析」发出 `POST .../L3_CORE_TEXT/generate` → 201，正文出现 |
| 9 | 浏览器控制台 | 无错误 | Errors: 0 / Warnings: 0 |

> 说明：`ArtifactStateHint` 的 PENDING 分支（「正在生成核心内容…」「正在出题…」）在真实环境只存在数百毫秒到数秒，
> 本次采样未能截到该瞬时文本；但其 FAILED 分支已在 #4 实测渲染，两者是同一模板里相邻的 `v-if/v-else-if`，
> 且 #7/#8 证明了各自的触发生成路径。**该瞬时文案属于「已实现但未直接目击」**，如实记录。

### 2.4 清理与残留

删除全部验证用户（5 个）后：

```
users=0  trees=0  nodes=0  contents=0  code_examples=0  exercises=0  gen_tasks=0
ai_generations=27（其中关联列非空的 0 行）
```

`generation_tasks` 随节点级联删除成立；审计表按设计留存且 `SET NULL` 生效。

### 2.5 上线后由真实操作暴露的第二个缺陷（已修复，提交 `e92cd7d`）

**用户操作路径**：点开一个 L2 → 在「概念」仍在生成时切到「练习题」tab。

**现象**：`POST /nodes/:id/artifacts/L3_EXERCISES/generate` 返回 **500**，前端提示
`Error: coreText 生成后仍不可用`；随后（coreText 落库后）该产物又能正常生成，但用户那一次点击被丢弃。

**根因**：`ensureCoreText` 把「coreText 正由**另一个请求**生成中」当成了失败。
`generateArtifact(L3_CORE_TEXT)` 因认领失败而立即返回 —— 这是**正常的并发状态**（前端设计本身就鼓励
coreText 阻塞、用户可自由切 tab），但旧实现紧接着回读 `node_contents`，此时对方尚未落库 → 抛 500。
连带的两个次生问题：① 用户意图被丢弃（对方生成成功后用户仍看到报错）；② 状态机被写入一条**假的 FAILED**
（内容根本没生成失败，只是还没轮到读），`last_error` 具有误导性。

**修复**：`ensureCoreText` 改为**有界等待 + 顺带重试认领**的轮询循环
（`CORE_TEXT_WAIT_MS = 60s`、`CORE_TEXT_POLL_MS = 1s`）：

- 每轮先读内容；没有则尝试认领并生成
- 认领失败（他人正在生成）→ 等一轮再看，而不是抛错
- 对方若最终失败并把任务标记 `FAILED`，下一轮就能接管生成（`FAILED` 可重认领）
- 只有超过总预算才显式失败，错误信息改为「等待 coreText 生成超时（60s），请稍后重试」

**验证**（单测 + 真实 AI 端到端各一条）：

| 手段 | 结果 |
|---|---|
| 单测（先红后绿） | 新增用例「coreText 正由他人生成时不失败」：修复前复现 `InternalServerErrorException: coreText 生成后仍不可用`，修复后断言 `markFailed` **未被调用**、练习题正常生成 |
| 全量回归 | 16 suites / **83 tests 全绿**（较 2.1 多 1 条即本用例） |
| 真实 AI 并发复现 | 同进程用 `HttpClient` 先发 coreText 请求、**900ms 后**（coreText 仍在飞行中）发练习题请求 → 两条均 **201**；练习题请求耗时 22.2s（等待 coreText 的 13.3s + 自身 8.6s）；`generation_tasks` 两行均 `READY / attempts=1 / last_error=null`；全库 FAILED 任务数 0 |

> 该次复现的审计顺带证明了**契约层重试**在真实模型上生效：coreText 第一次返回 `parsed_ok=false`（7.3s），
> 服务自动带 issues 以 0.3 温度重试，第二次通过（6.9s）—— 这也是等待预算必须覆盖「一次生成 + 一次重试」的原因。

### 2.6 同一轮使用中发现的既有 UI 缺陷（非阶段 4 引入，已修复，提交 `c182d95`）

**现象**：在左侧目录点某个节点（画布上该节点出现虚线描边），再点画布上另一个节点 → **两个节点同时带虚线描边**。

**根因**：节点描边有**两个互不相干的来源**——
`FlowNode` 的 `isOutlined = props.selected || props.highlighted`：

- `highlighted` ← 页面状态 `selectedNodeId`（左侧目录点击 → `activeDirectoryNodeId`）
- `selected` ← **Vue Flow 自身的点击选中态**（画布点击）

两者指向不同节点时就会同时为真。这是阶段 4 之前就存在的实现（`highlighted-node-id` 与 `:selected` 的接线早于本阶段），
只是这一轮手工测试才被发现。

**修复**：聚焦态收敛为**唯一来源**（页面状态）：

- `FlowNode` 不再接收 `selected`，`isOutlined` / `borderColorClass` 只看 `highlighted`；移除 `selectThisNode()` 与 `useVueFlow` 依赖
- `VueFlowGraph` 新增 `@node-click` → `selectNode`、`@pane-click` → `clearSelection`；节点内按钮点击额外发 `focus`
- `useSkillTreePage` 新增 `onCanvasNodeClick`（画布点击 ≡ 目录点击，只改聚焦、不移动视口、不开抽屉）与
  `onCanvasPaneClick`（清手动聚焦；抽屉仍开着时自动回落到抽屉所属节点）

**浏览器实测**（mock provider + 独立 dev server，真实 DOM 断言「虚线描边节点数」）：

| 操作 | 期望 | 实测 |
|---|---|---|
| 点左侧目录 L2 A | 恰好 1 个聚焦 | `["A"]` |
| 再点画布上 L2 B | 恰好 1 个聚焦，且换成 B | `["B"]`（修复前为 A+B 两个） |
| 点画布空白 | 0 个聚焦 | `[]` |
| 点画布 L2 C | 画布聚焦 = 目录高亮行 = C | 画布 `["C"]`／目录 `["C"]` |

---

## 三、执行偏差记录

### 3.1 计划片段有缺陷（实现时修正）

| # | 计划写法 | 问题 | 实际处理 |
|---|---|---|---|
| 1 | T3 只创建 `generation-task.service.ts` + spec | `generation_tasks` 实体在阶段 1 已建，但字段是 `lastError?: string` / `model?: string`，而 `markReady` 要写 `null`；TypeORM 的 `QueryDeepPartialEntity` **不接受 null**（除非属性类型含 `null`） | 改为 `lastError?: string \| null`（该列已有显式 `type:'text'`，安全）；`model` 补显式 `type:'varchar'` 后再改 `string \| null`。**不加显式 type 就写 `\| null` 会退化成 design:type=Object**（阶段 1 的坑，见阶段 1-2 验证文档） |
| 2 | T4 的 spec 把「注入的 `contentRepo`」与「事务内 `manager.getRepository(NodeContent)`」mock 成两个不同对象：前者返回已有内容、后者恒返回 null | 同一张表在测试里出现两个互相矛盾视图，**该 spec 与计划自己的实现不可能同时成立**（前置生成后回读必然读不到） | 改为一个**内存假库**：事务内外共用一个 repo stub，写入立刻对读取可见。7 个用例名与断言保持计划原样 |
| 3 | T1 未提到要改 `MockProvider` | 三个新 stage 的提示词里只有 `codeExamples` / `exercises` 标志，会**落到 L2 分支**返回 `{nodes}` → mock 模式下三个产物全部契约失败 | 在 mock 中按「格式段字段名」拆出三个分支，顺序为 `codeExamples → exercises → coreText`（前缀匹配，顺序敏感）；同时把 coreText 文本加长以过 `min(50)`、exercises 分支用 `单选题` 作兜底标志 |
| 4 | T1 Step 5 只列了 `content.service.*.spec.ts` 要改 | 还有两处：`ai-generation.service.spec.ts` 的 `stage:'l3-content'`（类型上已失效）、`content.service.transaction.spec.ts` 整体失效（其不变量已迁移到 ArtifactService） | 前者改 stage 名；后者**删除**（计划也说「Task 4 会整体重写为 ArtifactService 的测试」），`content.service.spec.ts` 收窄为「归属 + 短路 + 委托」 |
| 5 | T2 Step 2 期望 `dist/types`、`dist/esm`、`dist/cjs` **三份** `api.d.ts` 都含新类型 | 实际只有 `dist/types` 产出 `.d.ts`；esm/cjs 只 emit `.js`（纯类型文件产出空模块） | 只校验 `dist/types/interfaces/api.d.ts`；结论：新类型已导出 |
| 6 | T5 验证清单写「POST 期望 200」 | Nest 对 POST 默认返回 **201**，`TransformInterceptor` 不改状态码 | 实测 201，视为通过；前端 `useApi` 只解析 JSON 体，不受影响 |
| 7 | T7 Step 3：「`tabs` 显示条件改为 `codeExamples.status === READY && items.length > 0`」 | **这是本阶段唯一被验证抓出的真实缺陷**：代码示例产物 `FAILED` 时该 tab 直接消失 → 用户**没有任何入口看到失败并重试**（`prefetchCodeExamples` 又刻意不自动重试） | 改为「`FAILED` **或** `READY 且有内容` 才显示」；生成中仍不显示（避免空 tab）。修复后实测 #4/#5 通过 |
| 8 | T4 注释称「READY 但内容缺失会显式抛错」 | 未在真实路径触发（`ensureCoreText` 在任务为 PENDING 但内容存在时按 PENDING 走生成，不会走抛错分支） | 保留该防御性抛错；实测夹具 #8 证明该分支行为自洽（图上按 `contentReady` 退回「分析」） |

### 3.2 计划未覆盖但必须做的事

| # | 事项 | 原因 |
|---|---|---|
| 9 | 重建 `packages/prompt-manager` 与 `packages/ai-provider` 的 `dist` | apps/api 运行时读 `dist`：前者决定 stage 注册表，后者决定 mock 分支 |
| 10 | `ContentService` 删掉 `AiIntegrationService` / `DataSource` / `TreeNode` / `SkillTree` 注入与 `Exercise`/`CodeExample` 实体引用 | 职责移入 `ArtifactService` 后这些注入变成死代码（也是 `content.service.transaction.spec.ts` 必须删除的原因） |

### 3.3 环境限制（需要一次性权限升级）

| # | 现象 | 处理 |
|---|---|---|
| 11 | `nuxt dev` 在沙箱内 `spawn EPERM`（esbuild / vite 需要带管道的子进程） | 对**完全相同**的启动命令发起一次 `sandbox_permissions: danger-full-access` 升级后成功 |
| 12 | `playwright-cli` 的 daemon 写 `%LOCALAPPDATA%\ms-playwright\daemon\...`（工作区外）→ `EPERM` | 同样一次性升级；用完整权限跑通了 2.3 的全部场景 |
| 13 | `playwright-cli` 的浏览器会话**在两次独立命令之间会消失** | 必须把「open → 登录 → 导航 → 交互 → 取值」串成**同一条命令** |
| 14 | Vue Flow 节点里的按钮对 Playwright 的 `click()` 不可达（actionability 超时） | 改用 `dispatchEvent('click')` 或 `eval "...el.click()"` |
| 15 | `playwright-cli run-code` 里的 `console.log` **不会出现在输出里**（只写浏览器 console 日志） | 放弃脚本路线，改为「一条命令里多次 `eval`」逐段取值 |

---

## 四、沙箱环境知识（新增/修正）

1. **PowerShell 里 `$env:VAR=''` 会「删除」该变量**（`Environment.SetEnvironmentVariable` 语义），
   `dotenv` 随后会从 `.env` 把值补回来 —— 想模拟「key 失效」必须设**非空但无效**的值
   （本次用 `sk-invalid-phase4-test`）。我因此浪费了一次 E2E 步骤（第一次"失败注入"实际调通了真实 AI）。
2. **psql 不在 PATH**，实际路径 `D:\Environment\PostgreSQL\18\bin\psql.exe`；中文/多语句 SQL 一律走 `-f <utf8 文件>`。
3. **浏览器验证的成本结构**：`nuxt dev` 冷启动约 30-60 s（含 vite 依赖预构建），单次 playwright 命令内的
   登录 + 导航 + 等待约 20 s；因此**一次命令做尽可能多的事**，不要跨命令复用会话。
4. **`generation_tasks` 的 `attempts` 语义**：每次**认领成功** +1（首次插入为 1），
   因此「POST 两次 coreText 后 attempts 仍是 1」是幂等的强证据（第二次根本没认领到）。
5. **同一 stage 的审计行数 = 真实 AI 调用次数**：`l3-core-text` 在两个节点各 1 行、`l3-exercises` 在三个节点各 1 行，
   与 `parsed_ok=true`、无 `error_kind` 共同证明「契约层零重试」。

---

## 五、遗留事项（交给阶段 5 及后续）

| 事项 | 归属 |
|---|---|
| 「节点过期（OUTDATED_II/III）→ 重新生成 coreText 并 bump `version`」流程缺失；`NodeContent.version` 目前只在 coreText 重新生成时 +1 | **阶段 5（主目标）** |
| 代码示例 / 练习题重新生成是「先删后插」，不留历史版本（无 version 概念） | 阶段 5 视需求 |
| `interview.service.ts` 仍用内存 `Map` 做并发去重（阶段 4 的库级认领已具备替代能力，但本阶段未迁移） | 阶段 5 或清理候选 |
| `prefetchCodeExamples` 会在用户没看代码示例时也消耗 token（计划已标注的取舍，一处开关可退回「切 tab 才生成」） | 清理候选 |
| `GET /nodes/:id/content`（legacy）会额外查一次产物状态（多 2 条 SELECT） | 清理候选：前端迁移完成后下线 legacy 端点 |
| 前端仍无测试（`useSkillTreePage` 的产物状态机只靠手测覆盖） | 清理候选 |
| `*.selfcheck.ts` 仍被编译进 dist；`packages/shared/src/index.ts` 显式导出列表仍需人工同步 | 阶段 3 遗留，未变 |
| `tree_nodes.level` 枚举含未使用的 L3；`skill_trees.keywords` 只写不读 | 阶段 3 遗留，未变 |
