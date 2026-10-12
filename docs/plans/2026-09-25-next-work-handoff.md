# 交付文档：cogni-tree 下一阶段工作（4 个工作项）

> **这份文档给谁看**：给「新开一个窗口继续做这个项目」的 AI 助手（或你自己）。
> 新窗口**没有**本次会话的任何上下文，所以本文档自带：仓库现状、工作项定义、验收标准、环境命令、沙箱坑、验证基线。
>
> **建议开场白**（直接粘给新会话）：
> 「读 `docs/plans/2026-09-25-next-work-handoff.md`，然后我们来讨论 W1（CI）。先按文档里的『环境与命令』确认基线，再给方案。」

**当前状态**：阶段 1–5 全部完成并已推送到 `origin/main`；本文档列的 4 项是**尚未开始**的新工作。

---

## 一、仓库现状（开始前请先核对）

| 项 | 值 |
|---|---|
| 分支 | `main`，跟踪 `origin/main`（`git@github.com:SatomiKazeHiro/cogin-tree.git`） |
| 最新提交 | `76aa5f6`（本文档提交后为下一笔） |
| 已完成 | 阶段 1–2 表结构/授权、阶段 3 AI 契约层、阶段 4 产物状态机与 stage 拆分、阶段 5 过期→重新生成、代码块语法高亮 |
| 数据库 | PostgreSQL 18.4 / 库 `skill_learning`，走 migration（`synchronize: false`）。库里只有本地测试数据 |
| 结构 | pnpm monorepo：`apps/api`（NestJS 10 + TypeORM + PG）、`apps/web`（Nuxt 3 + Vue 3 + Pinia + Tailwind v4 + @vue-flow）、`packages/shared`、`packages/ai-provider`、`packages/prompt-manager` |

### 已完成工作的记录（避免重复劳动）

| 文档 | 内容 |
|---|---|
| `docs/specs/2026-09-16-ai-contract-and-dataflow-design.md` | 总设计（含 D1–D12 决策）：契约化、数据流五原则、目标表结构 |
| `docs/plans/2026-09-16-phase{1-2,3,4,5}-*.md` | 各阶段实施计划 + **验证记录与执行偏差**（偏差一节尤其值得先读，很多坑已在里面） |
| `docs/plans/2026-09-16-phase5-verification.md` | 最新一份：含「沙箱环境知识」与遗留事项 |
| `AGENTS.md` | 面向 AI 的项目指南（模块表、端点表、代码约定、已知限制）；**改代码后请同步它** |
| `docs/系统架构设计.md` | 数据模型与端点（已按代码校准） |

---

## 二、工作项

### W1 — 补 CI，并修好坏掉的 lint（**建议先做，性价比最高**）

**为什么**：`.github/` 不存在，typecheck / jest / selfcheck 全靠人工敲；本次会话反复证明「不真跑就发现不了」——竞态 500、聚焦双描边、Vue 代码不高亮、Windows 权限问题，全是运行期才暴露的。同时根 `package.json` 有 `lint` 脚本，但仓库里**没有任何 eslint 依赖或配置**，执行必然失败（误导性脚本）。

**要做的**

1. 新增 `.github/workflows/ci.yml`，至少在 PR / push 到 `main` 时跑：
   - `pnpm install --frozen-lockfile`（仓库锁定 pnpm 9.0.0：读根 `package.json` 的 `packageManager`）
   - `pnpm --filter shared build && pnpm --filter prompt-manager build && pnpm --filter ai-provider build`
     （**必须先 build**：tsc 走 `packages/*/src`，但 jest/nest/ts-node 运行时走 `packages/*/dist`）
   - `pnpm --filter api typecheck`（`tsc --noEmit`）与 `pnpm --filter web typecheck`（`nuxt typecheck`）
   - `pnpm --filter api test`（jest）
   - 三个契约自检：`packages/prompt-manager` 下 `ts-node src/prompt-engine.selfcheck.ts`、`src/prompt-manager.selfcheck.ts`、`src/stages.selfcheck.ts`（三个都输出 `SELFCHECK OK`）
   - 可选（需要 Postgres service container）：`apps/api/scripts/verify-schema.ts` → `SCHEMA OK`
2. **二选一处理 lint**：要么加 `eslint` + `typescript-eslint` + `eslint-plugin-vue` 并配好，要么**删掉 `lint` 脚本**（当前它只会误导）。建议先删，等有精力再正经引入。
3. 顺手在 CI 里加 `pnpm --filter web exec vue-tsc --noEmit`（等价于 `nuxt typecheck`，但**不写 `.nuxt`**；见「沙箱坑」第 4 条）。

**验收**：推一个空提交或 PR，CI 全绿；把 CI 徽章或跑法写进 `AGENTS.md`。

**注意**：CI 里 jest 必须 `--runInBand`（本机不加会因 worker 进程 `spawn EPERM` 失败；CI 上虽不必然，但保持一致）。

---

### W2 — 前端测试基建（当前 **0 个测试**）

**为什么**：`apps/web` 没有任何测试依赖、0 个测试文件；而后端已有 16 个 spec / 91 个用例。最近三次前端改动（产物状态机、聚焦态、语法高亮）全靠手工+浏览器验证，回归风险最大。

**要做的**

1. 引入 vitest（Nuxt 官方推荐配 `@nuxt/test-utils`；若要更轻，也可只对「纯函数」用裸 vitest）。**注意**：装依赖需要沙箱升级（见「沙箱坑」第 1 条）。
2. 优先覆盖两个**高价值、可确定**的目标：
   - `apps/web/utils/highlight.ts`：语言别名解析（`vue→自写 grammar`、`ts/js/py/sh` 等）、未注册语言降级为转义纯文本、`<script setup lang="ts">` 走 typescript。**纯函数、零 DOM 依赖，最容易起手。**
   - `apps/web/composables/useSkillTreePage.ts`：产物状态机分支（`ensureCoreText` 的 READY/GENERATING/PENDING 三条路径、`waitForCoreText` 轮询成功与超时、`prefetchCodeExamples` 的跳过条件、`regenerateNode` 后 `nodeStatus` 就地回写）。
     ⚠️ 这个 composable 依赖 Nuxt 自动导入的 `useApi` / `useToast` / `useTreeLayout`：**要么**用 `@nuxt/test-utils` 起 Nuxt 环境，**要么**先把纯逻辑抽成不依赖 Nuxt 的函数再测。两条路都行，但请在方案里明确选一条。
3. 加 `test` 脚本并接进 W1 的 CI。

**验收**：`pnpm --filter web test` 可跑；至少覆盖上面两类分支；CI 里包含它。

---

### W3 — 「复用已有输入」：把用户上下文喂进 L3 生成（产品价值最高）

**为什么**：设计文档 `第 1.2 节` 明确把「复用已有输入」列为**本轮不做但留好通道**的事项；通道就是「生成入参结构支持携带画像/学习记录/兄弟节点/历史产物摘要」。现在 `l3-core-text` 的输入只有 `{ skillTreeName, l1Title, l2Title }` —— 生成的正文与**这个用户**的方向、水平、目标完全无关。

**要做的**

1. 扩展契约：`packages/prompt-manager/src/templates/stage-3a-l3-core-text.ts` 的 Input 增加可选字段（建议：`learnerPortrait?`（画像摘要）、`learningContext?`（进度/已学节点）、`siblingTitles?`（同一 L1 下的其他 L2，避免内容重复）），并把这些写进提示词正文；**同时递增模板 `version`**（`prompt_version` 会落进 `ai_generations`，便于按版本对比效果与成本）。
2. 传参：`apps/api/src/modules/content/artifact.service.ts` 的 `loadContext()` 已注入 `nodeRepo`/`treeRepo`；取画像需要读 `user_profiles.computed_portrait`（`UserProfile` 实体）—— 视实现选择注入对应的 repository 或复用现有服务，注意**不要在事务里做额外查询**（该服务是「先算后落库」）。
3. 同理可评估是否给 `l3-code-examples` / `l3-exercises` 带上画像（**建议只做 coreText**，避免一次改动面过大；拆分后的好处正是可以逐个 stage 推进）。
4. 成本与效果观测：`ai_generations` 已记录 `stage / prompt_version / prompt_tokens / completion_tokens / latency_ms`，改动前后用 SQL 对比即可（见「验证基线」里的查询）。

**验收**：同一棵树同一个 L2，改动前后各生成一次，正文明显更贴合用户画像/水平；`ai_generations` 里 `prompt_version` 变化、token 增量有记录；契约自检与单测更新；`AGENTS.md` 的 stage 说明同步。

**坑**：zod schema 必须保持 JSON-Schema 可表示（禁 `z.date()`/`z.transform()`/`z.custom()`）；跨字段约束走 `invariants`。改完 `packages/prompt-manager` **必须重新 build dist**，否则 API 运行时用的是旧代码。

---

### W4 — interview 的并发去重从内存 Map 迁到库级认领

**为什么**：`apps/api/src/modules/interview/interview.service.ts` 用进程内 `Map<nodeId, Promise>` 做「同一节点只生成一次」的去重 —— **进程重启即失效、多实例下完全失效**。产物侧（`generation_tasks` + 条件 UPDATE）已经解决了同类问题，interview 没跟上（阶段 4 有意留的，见设计文档 1.2）。

**要做的**

1. 选方案（**这里有一个必须留意的取舍**）：
   - **方案 A**：给 `ArtifactKind` 枚举加 `INTERVIEW_QA`，复用 `generation_tasks`。
     ⚠️ `artifact_kind` 是 **PostgreSQL 原生枚举** `generation_tasks_artifact_kind_enum`，加值需要 `ALTER TYPE ... ADD VALUE`（**该语句不能在事务里回滚**），必须写成 migration 并单独验证。
   - **方案 B**：不扩枚举，用「同一套条件 UPDATE 语义」为 interview 建一张小表（如 `interview_tasks(node_id UNIQUE, status, attempts, started_at, ...)`）。
   - **建议 A**：语义统一、少一张表；代价是一次枚举迁移。请在方案里写清回滚策略（`ADD VALUE` 不可逆，但留着不用也无害）。
2. 改造 `interview.service.ts`：认领失败 → 直接返回当前聚合结果（幂等）；生成失败写 `FAILED` + `last_error` 并可重试（现在失败只是 log）。
3. 更新 `apps/api/src/modules/interview/interview.service.spec.ts`（现有用例覆盖了内存去重，要改成断言「认领失败不重复调 AI」）。

**验收**：单测覆盖「认领成功生成 / 认领失败不重复调 AI / 失败标记可重试」；真实库手工验证两次并发请求只生成一次；`AGENTS.md` 的已知限制里删掉这一条。

---

## 三、已核实「不需要做」的（省得新窗口重复调研）

| 事项 | 结论 |
|---|---|
| `skill_trees.keywords` 是「只写不读的死字段」 | **说法有误**（出自 `phase3-verification.md` 的旧结论）。它**被前端读**：`apps/web/components/dashboard/SkillCard.vue` 把 `tree.keywords` 当标签展示，`dashboard.vue` 用它预填创建向导。**不要删这一列。** |
| `NodeLevel.L3` 未使用 | 属实，但**保留**：DB 枚举 `tree_nodes_level_enum` 里也有 `'3'`，删掉需要一次改写枚举类型的迁移且无收益。已在 `packages/shared/src/enums/index.ts` 加注释说明。 |
| `packages/shared/src/index.ts` 的具名导出要人工同步 | **已修**（`76aa5f6`）：`enums` 改为 `export *` 转发，从此不用同步。 |
| `*.selfcheck.ts` 被打进 dist | **已修**（`76aa5f6`）：`packages/prompt-manager/tsconfig.json` 增加 `exclude: ["src/**/*.selfcheck.ts"]`，重建后 dist 里 0 个 selfcheck 产物。 |
| 部署基建（Docker / compose / 启动迁移） | **本轮明确不做**（你已决定移除）。生产化时再单独立项：至少要有 `migrate` 启动步骤（`synchronize:false` 下目前没有自动迁移入口）。 |
| 前端可视化（用户“有想法”） | **本轮明确不做**，等你给出具体想法再立项。 |

---

## 四、环境与命令（新窗口必读）

### 常用命令

```powershell
# 启动（清理 3001/3002 后同时起 API + Web；API 是 nest --watch，Web 是 nuxt dev HMR）
pnpm dev

# 类型检查
cd apps/api;  node_modules\.bin\tsc --noEmit
cd apps/web;  node_modules\.bin\nuxt typecheck          # 会写 .nuxt；被权限挡住时改用下面这条
cd apps/web;  node_modules\.bin\vue-tsc.CMD --noEmit -p tsconfig.json

# 测试（必须 --runInBand）
cd apps/api;  node_modules\.bin\jest --runInBand

# 结构断言（连真实库）
cd apps/api;  node_modules\.bin\ts-node scripts/verify-schema.ts

# 契约自检（三个都要输出 SELFCHECK OK）
cd packages/prompt-manager
..\..\apps\api\node_modules\.bin\ts-node src/prompt-engine.selfcheck.ts
..\..\apps\api\node_modules\.bin\ts-node src/prompt-manager.selfcheck.ts
..\..\apps\api\node_modules\.bin\ts-node src/stages.selfcheck.ts

# 改完工作区包必须重建 dist（否则运行时用旧代码）
node_modules\.bin\tsc -p packages/shared/tsconfig.json
node_modules\.bin\tsc -p packages/shared/tsconfig.cjs.json
node_modules\.bin\tsc -p packages/prompt-manager/tsconfig.json
node_modules\.bin\tsc -p packages/ai-provider/tsconfig.json
```

### 验证基线（2026-09-25 实测，改动后请对照）

| 检查 | 基线 |
|---|---|
| `apps/api` `tsc --noEmit` | exit 0 |
| `apps/api` `jest --runInBand` | **16 suites / 91 tests 全绿** |
| `apps/web` `vue-tsc --noEmit` | exit 0 |
| 三个契约自检 | 三个 `SELFCHECK OK` |
| `scripts/verify-schema.ts` | `SCHEMA OK`（24 条断言，含「0 个 NO ACTION 外键」「19 个非唯一索引」） |
| `packages/prompt-manager/dist` | 0 个 `*selfcheck*` 产物 |
| `packages/shared` 导出 | `export *` 转发，12+ 枚举齐全（含 `NodeLevel.L3 = 3`） |

### 沙箱坑（都是踩过的，务必先读）

1. **`pnpm <script>` / `pnpm add` 在沙箱内会 `EPERM`**（pnpm 是打包二进制，会 spawn node 并用管道捕获输出）。绕法：直接用 `node_modules/.bin/*`，或对那条命令申请一次 `sandbox_permissions: danger-full-access` 升级；装依赖还要 `--store-dir "D:\.pnpm-store\v3"` + `$env:PNPM_HOME=<workspace>/.pnpm-home`。
2. **bin 的位置**：根 `node_modules/.bin` 只有 `tsc`；`ts-node` / `jest` / `nest` / `typeorm` 在 `apps/api/node_modules/.bin`；`vue-tsc` 在 `apps/web/node_modules/.bin`。
3. **`nuxt dev` 与 `playwright-cli` 都需要一次权限升级**：前者要 spawn esbuild（管道 EPERM），后者的浏览器守护进程写在 `%LOCALAPPDATA%` 之外的工作区外。
4. **`nuxt typecheck` 会写 `.nuxt/schema/*.json`**，该目录可能被 Windows 文件权限挡住（`EPERM`）。两个办法：改用 `vue-tsc`（不写 `.nuxt`，推荐），或修权限（见第 5 条）。
5. **Windows 文件权限问题**：本机出现过「工作区内写入被拒」，用技能 `diagnose-windows-sandbox-acl` 的脚本修（一条命令同时诊断+修补，需一次升级；报告与回滚脚本落在 `D:\Git\personal\dsh-acl-recovery\`）。注意：**删除文件**在当前沙箱下常被拒（根目录有一条对所有用户的「禁止删除子项」规则），如需删除临时文件请手工删。
6. **`psql -c` 里禁止中文字面量**（会报 `无效的 "UTF8" 编码字节顺序`）。要么纯 ASCII，要么写 UTF-8 的 `.sql` 文件用 `-f`。psql 不在 PATH：`D:\Environment\PostgreSQL\18\bin\psql.exe`，密码在 `.env` 的 `DB_PASSWORD`。
7. **`generation_tasks` 的 `attempts` 是「认领次数」**，不是 AI 调用次数；`ai_generations` 才是每次真实调用的审计（含重试各一行）。
8. **改前端样式/主题**后建议硬刷新（HMR 对 CSS 变量不一定即时生效）。

---

## 五、本次相关代码结构速览

```
AI 调用链：
  packages/prompt-manager/src/templates/stage-*.ts     # 契约（zod schema + 提示词正文，同源）
  packages/prompt-manager/src/prompt-engine.ts         # defineTemplate / parseWithSchema / AiContractError
  apps/api/src/modules/ai-integration/ai-integration.service.ts  # 唯一 AI 入口：调用→审计→契约校验→带反馈重试一次
  apps/api/src/modules/ai-integration/ai-generation.service.ts   # 写 ai_generations（永不上抛）

产物状态机：
  apps/api/src/modules/content/generation-task.service.ts  # 库级原子认领（force / 120s 陈旧回收）
  apps/api/src/modules/content/artifact.service.ts         # 编排：认领→前置 coreText→调 AI→单事务落库→标记
  apps/api/src/modules/content/content.controller.ts       # /nodes/:id/artifacts[...]，legacy /content
  apps/api/src/modules/content/entities/generation-task.entity.ts

前端（技能树页）：
  apps/web/pages/skills/[id]/tree.vue
  apps/web/composables/useSkillTreePage.ts     # 页面状态机（产物状态、分块生成、等待轮询、重新生成）
  apps/web/composables/useTreeLayout.ts        # 树 → Vue Flow 节点/边
  apps/web/components/tree/L3Content.vue       # 三区块渲染 + 单产物重新生成
  apps/web/components/tree/ArtifactStateHint.vue  # 生成中 / 失败可重试 / 合法空
  apps/web/utils/highlight.ts                  # 语法高亮（slim build + 别名 + 自写 Vue grammar）
  apps/web/assets/css/tailwind.css             # 语义 token（含 --code-* 语法高亮调色板，亮/暗两套）

数据表（17 张，显式注册在 apps/api/src/config/database.config.ts）：
  users / user_profiles / portrait_questions / portrait_answers
  skill_trees / tree_nodes
  node_contents / code_examples / exercises / generation_tasks
  ai_generations
  learning_records / node_learning_records
  recommendations / interview_questions
  analysis_jobs / suggested_changes
```

### 有用的观测 SQL（改 AI 相关逻辑时用）

```sql
-- 各 stage 的调用量 / 契约失败率 / token / 耗时（按改动前后的时间窗对比）
select stage, count(*) calls,
       bool_and(parsed_ok) all_ok,
       sum(prompt_tokens) ptok, sum(completion_tokens) ctok,
       round(avg(latency_ms)) avg_ms
from ai_generations
where created_at > now() - interval '1 day'
group by stage order by stage;

-- 某节点的产物状态
select artifact_kind, status, attempts, (last_error is null) as no_err
from generation_tasks where node_id = '<uuid>' order by artifact_kind;
```

---

## 六、工作纪律（沿用前几个阶段的做法，本项目已验证有效）

1. **先写文档再动代码**：新工作项先落 `docs/plans/<日期>-<主题>.md`（目标 / 全局约束 / 文件结构 / 分步任务 / 自检 / 风险），再按任务逐步实施。
2. **任务边界提交**：每个 Task 单独提交，提交信息用 `<emoji> <type>: <中文描述>`（仓库既有风格）。
3. **文档与代码同步**：改完同步 `AGENTS.md`（模块表/端点表/已知限制）与 `docs/系统架构设计.md`（数据模型/端点）。
4. **阶段末尾写验证记录**：`docs/plans/<日期>-<主题>-verification.md`，包含验证矩阵、真实端到端结果、**执行偏差**（计划哪里写错了、怎么改的）、沙箱知识新增、遗留事项。
5. **不要声称未验证的事**：跑过再把数字写进文档（本项目的验证记录里每个数字都有对应的真实输出）。
