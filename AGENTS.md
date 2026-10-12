# AGENTS.md — AI 编码助手项目指南

> 本文件面向需要在本仓库中工作的 AI 编码助手。阅读者被假定为完全不了解本项目。本文档基于仓库实际内容编写，不做推测。

---

## 项目概览

本项目是一个**技能树学习系统**（Skill Tree Learning Platform），采用 **pnpm monorepo** 组织。核心能力包括：

- 用户注册/登录（JWT）。
- 用户肖像问卷：注册后引导用户完成身份/兴趣/目标/背景四类选择题，由 AI 生成肖像摘要。
- 学习仪表盘：展示"我的技能树"、"正在学习"与"为你推荐"三个区块；"正在学习"展示每个技能树的进度与最近学习节点。
- 技能树：以 root → L1 → L2 三层节点组织学习方向；L2 作为叶节点，其 L3 学习内容在右侧抽屉展示。
- 学习状态：每个节点可标记为 `NOT_STARTED` / `IN_PROGRESS` / `COMPLETED` / `SKIPPED`，仪表盘与节点上同步显示。
- AI 推荐：基于用户肖像与当前学习情况生成最多 10 个学习方向推荐。
- AI 内容生成：自动生成 L1 大纲、L2 节点、L3 核心文本/代码示例/练习题；L3 max_tokens 可通过 `.env` 的 `AI_L3_MAX_TOKENS` 配置。
- 节点时效标记：节点状态包括 `ACTIVE`、`OUTDATED_I`、`OUTDATED_II`、`OUTDATED_III`（见 `packages/shared/src/enums/index.ts`）。

技术栈：

- **前端**：Vue 3 + Nuxt 3 + Pinia + Tailwind CSS v4（alpha）+ `@vue-flow/core`。
- **后端**：NestJS 10 + TypeORM + PostgreSQL + Passport JWT。
- **工作区包**：`@skill/shared`（枚举/DTO）、`@skill/ai-provider`（AI Provider 抽象）、`@skill/prompt-manager`（Prompt 模板 + zod 契约层）。
- **包管理器**：pnpm 9.0.0（在根 `package.json` 的 `packageManager` 中锁定），要求 Node.js >= 20。
- **任务编排**：根目录使用 `turbo`（v2），`turbo.json` 已配置：`build/typecheck/test` 依赖 `^build`（workspace 包先构建），并启用任务缓存。

---

## 仓库结构

```
D:/Git/personal/cogni-tree
├── apps/
│   ├── api/                 # NestJS 后端（@skill/api）
│   └── web/                 # Nuxt 3 前端（@skill/web）
├── packages/
│   ├── shared/              # 共享枚举、实体接口、常量（@skill/shared）
│   ├── ai-provider/         # IAIProvider + DeepSeek/OpenAI-compatible/Mock 实现
│   └── prompt-manager/      # Prompt 模板 + zod 契约层（stage 0–8 共 11 个）
├── scripts/
│   └── dev.js               # 同时启动 API + Web 开发服务器（先清理 3001/3002 端口）
├── docs/
│   ├── DESIGN.md            # 视觉/设计系统文档（英文）
│   ├── 系统架构设计.md      # 系统架构与数据模型文档（中文）
│   ├── specs/               # 设计文档（如「AI 契约层与数据流重构」，含 D1–D12 决策）
│   └── plans/               # 分阶段实施计划 + 验证记录 + 下一阶段交接文档
├── .env                     # 本地环境变量（已 gitignore，参考 .env.example）
├── .env.example             # 环境变量示例
├── pnpm-workspace.yaml      # workspace: apps/*, packages/*
├── package.json             # 根脚本与 devDependencies
├── tsconfig.json            # 根 TypeScript 配置（供未独立 tsconfig 的包参考）
└── AGENTS.md                # 本文件（AI 编码助手项目指南）
```

### 后端模块 (`apps/api/src/modules/`)

| 模块 | 职责 |
|------|------|
| `auth` | JWT 注册/登录、`JwtStrategy`、`JwtAuthGuard` |
| `user` | 用户/用户画像（`User`、`UserProfile`）CRUD |
| `tree-access` | 树归属校验（`TreeAccessService`）：`skill-tree` / `tree-node` / `content` / `interview` / `analysis` 的读写端点统一经它做 owner 校验，越权抛 **403**（而非 404） |
| `portrait` | 肖像问卷题目与提交、AI 生成肖像摘要、原始答案落库（`PortraitAnswer`） |
| `skill-tree` | 技能树（`SkillTree`）与 L1 节点（`TreeNode`）CRUD、自动生成 L1 |
| `tree-node` | 节点展开（生成 L2）、子节点查询、节点编辑删除 |
| `content` | L3 产物（`NodeContent` / `CodeExample` / `Exercise`）与生成任务（`GenerationTask`）——`ArtifactService` 负责编排（库级幂等认领 → 前置 coreText → 单事务落库 → 标记状态），`GenerationTaskService` 负责状态机，`ContentService` 只管读写与 legacy 兼容 |
| `learning-record` | 用户与学习方向/节点的关联记录（`LearningRecord`、`NodeLearningRecord`） |
| `recommendation` | 推荐列表、按需刷新、从推荐创建技能树 |
| `interview` | 面试 Q&A（`InterviewQuestion`）：题目挂在 L2 节点上（FK 级联删除），打开面试页时对无题节点后台懒生成（stage 6 按节点出题），`GET /skill-trees/:id/interview` 返回按节点分组的聚合结果 |
| `analysis` | 按树 AI 分析（stage 4/5）：新增发现 + 过期检查，`AnalysisJob` / `SuggestedChange`，建议采纳/忽略；分析输入包含 PENDING 建议标题用于去重 |
| `dashboard` | 仪表盘数据聚合 |
| `ai-integration` | 统一调用 `@skill/ai-provider` 与 `@skill/prompt-manager`，从 `.env` 读取 AI 配置 |

其他后端要点：

- `apps/api/src/health/health.controller.ts`：健康检查端点。
- `apps/api/src/seeds/portrait-questions.seed.ts`：肖像问卷题目种子数据。
- `apps/api/src/common/`：全局异常过滤器（`GlobalExceptionFilter`）与响应转换拦截器（`TransformInterceptor`），在 `app.module.ts` 中通过 `APP_FILTER` / `APP_INTERCEPTOR` 注册。

注意：

- 推荐定时调度（`recommendation-scheduler`）在设计文档中有规划，但**当前未实现**（依赖里没有 `@nestjs/schedule`，代码中也没有 `@Cron`）；推荐是按需生成（用户访问推荐接口时检查 3 天 TTL，见 `recommendation.service.ts` 的 `RECOMMENDATION_TTL_DAYS = 3`）。
- `docs/系统架构设计.md` 已按代码校准（每个「未实现 / 设计稿」都会显式标注）；其「八、API 端点设计」即实际端点。若两者仍有出入，**以控制器代码为准**。

### 前端结构 (`apps/web/`)

| 目录/文件 | 说明 |
|-----------|------|
| `pages/` | Nuxt 文件路由：`index`、`login`、`register`、`onboarding`、`dashboard`、`settings`、`skills/create`、`skills/[id]/tree`、`skills/[id]/interview` |
| `layouts/` | `default.vue`（常规页面，内容区 max-width 1200px）、`fullscreen.vue`（技能树全屏，`h-screen`，导航自动铺满宽度） |
| `components/tree/` | 技能树 Vue Flow 相关组件，按 `Tree` 前缀自动注册（如 `TreeVueFlowGraph`、`TreeDirectoryPanel`、`TreeL3Content`、`TreeExerciseCard`、`TreeArtifactStateHint`——后者渲染产物的「生成中 / 失败可重试 / 合法空」三种非就绪状态） |
| `components/dashboard/` | 仪表盘组件（如 `DashboardSkillCard`、`DashboardCurrentLearningSection`、`DashboardRecommendationSection`、`DashboardSkillTreeWizard`） |
| `components/portrait/` | 肖像问卷组件（`PortraitQuestionStep`、`PortraitSummary`、`PortraitProgressBar`） |
| `components/interview/` | 面试模式组件（`InterviewQuestionCard`、`InterviewDifficultyFilter`），按 `Interview` 前缀自动注册 |
| `components/App*.vue` | 通用组件：`AppButton`、`AppCard`、`AppInput`、`AppNav`、`AppToast`、`AppConfirmDialog`、`AppSkeleton` |
| `components/UserMenu.vue` | 右上角用户菜单（设置/退出） |
| `components/ThemeToggle.vue` | 主题切换按钮 |
| `components/DashboardSkeletonCard.vue` | 仪表盘卡片骨架屏 |
| `components/EmptyState.vue` | 空状态占位组件 |
| `composables/` | `useApi`、`useAuthStore`、`useTreeLayout`、`useSkillTreePage`、`usePageHeader`、`useToast`、`useConfirm`、`useTheme` |
| `utils/learning-status.ts` | 学习状态相关的纯函数工具 |
| `utils/highlight.ts` | 语法高亮（highlight.js slim build + 语言别名 + 自写 Vue grammar；未注册语言降级为转义纯文本）；配色 token 是 `tailwind.css` 里的 `--code-*`（亮/暗两套） |
| `middleware/auth.ts` | 未登录用户重定向到 `/login`（`skill-token` cookie） |
| `assets/css/tailwind.css` | Tailwind v4 主题与设计 token |

注：`stores/` 与 `types/` 目录当前为空（状态管理实际通过 `composables/` 中的 Pinia store 完成）。

---

## 环境要求

- **Node.js**：>= 20
- **包管理器**：pnpm 9.0.0（在 `package.json` 的 `packageManager` 中锁定）
- **数据库**：PostgreSQL，默认 `localhost:5432`
- **AI Provider**：`.env.example` 默认 `deepseek`；代码在 `AI_PROVIDER` 未设置时回退到 `mock`（`ai-integration.service.ts`）。需要有效的 `AI_API_KEY` 才能调用真实模型

---

## 环境变量

复制 `.env.example` 为 `.env` 并填写。关键变量：

```bash
# 数据库
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=
DB_DATABASE=skill_learning

# JWT
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=7d

# AI Provider（仅读取 .env）
AI_PROVIDER=deepseek        # deepseek | openai | mock
AI_API_KEY=
AI_MODEL=deepseek-chat
AI_BASE_URL=https://api.deepseek.com

# AI generation tuning
AI_L3_MAX_TOKENS=4096

# 端口
API_PORT=3002
WEB_PORT=3001
NODE_ENV=development
```

前端独立读取 `apps/web/.env`：

```bash
# apps/web/.env
NUXT_PUBLIC_API_BASE_URL=http://localhost:3002/api
```

> 重要：Nuxt **不会**读取仓库根目录的 `.env`，`NUXT_PUBLIC_API_BASE_URL` 必须放在 `apps/web/.env` 中（`nuxt.config.ts` 中也有同名默认值兜底）。

---

## 常用开发命令

所有命令均在仓库根目录执行：

```bash
# 安装依赖
pnpm install

# 同时启动 API + Web 开发服务器（scripts/dev.js 会先清理 3001/3002 端口，支持 Windows/Unix）
pnpm dev

# 单独启动
pnpm --filter api start:dev
pnpm --filter web dev

# 构建（后端使用 webpack，前端使用 Nuxt）
pnpm build

# 类型检查
pnpm typecheck
# 或分别检查
pnpm --filter api typecheck      # tsc --noEmit
pnpm --filter web typecheck      # nuxt typecheck

# 测试
pnpm test
# 实际仅 apps/api 有 Jest 测试（见「测试策略」）；`pnpm test` 会调用 turbo run test

# Lint（注意：apps/api 只有 lint 脚本，仓库内既无 eslint 配置也无 eslint 依赖，当前执行会失败）
pnpm lint
```

> 上面是**常规（非沙箱）**执行方式。在 DSH 沙箱内直接跑 `pnpm <script>` 会 `EPERM` —— 本机执行的替代方式见下文「本机 / DSH 沙箱下的执行方式」。

### 工作区包构建

`@skill/shared`、`@skill/ai-provider`、`@skill/prompt-manager` 都需要先编译为 `dist/`：

```bash
pnpm --filter shared build
pnpm --filter ai-provider build
pnpm --filter prompt-manager build
```

修改 `packages/shared` 后，必须重新 build，并**删除 Vite 缓存**：

```bash
pnpm --filter shared build
rm -rf node_modules/.vite apps/web/.nuxt
pnpm dev
```

> 原因：`shared` 同时输出 ESM (`dist/esm/`) 与 CJS (`dist/cjs/`)，类型定义在 `dist/types/`；Vite 会预打包缓存；不清理缓存会导致前端拿到旧类型/值。
> `@skill/shared` 的 `package.json` 已配置 `exports` 字段，`apps/web/nuxt.config.ts` 中已加入 `build.transpile: ['@skill/shared']`，以兼容 Nuxt 生产构建的 ESM/CJS 互操作。

### 数据库迁移

`synchronize: false` 下，schema 变更**只能**走迁移（`apps/api/src/migrations/`）：

```bash
pnpm --filter api migration:run      # 应用迁移
pnpm --filter api migration:revert   # 回滚最后一个
pnpm --filter api migration:generate -- src/migrations/<Name>   # 由实体差异生成
pnpm --filter api schema:verify      # 结构断言（连真实库，输出 SCHEMA OK）
```

> 初始迁移是「空库 `migration:generate` → 人工评审」的产物。**不要**为了省事把 `synchronize` 打开。

### 本机 / DSH 沙箱下的执行方式（实测）

**`pnpm <script>` 与 `pnpm add` 在沙箱内会 `EPERM`**：pnpm 是打包二进制，会 `spawnSync node --version` 并用管道捕获输出，而沙箱禁止这类管道 stdio。**不要反复重试同一条 pnpm 命令**——改用直接调用 `node_modules/.bin/*`，或对该条命令申请一次权限升级（装依赖还需 `--store-dir "D:\.pnpm-store\v3"` + `$env:PNPM_HOME=<workspace>/.pnpm-home`）。

bin 的位置（根 `node_modules/.bin` 只有 `tsc` 与 `turbo`；`ts-node` / `jest` / `nest` / `typeorm` 在 `apps/api/node_modules/.bin`；`vue-tsc` 在 `apps/web/node_modules/.bin`）：

```powershell
# 类型检查
cd apps/api;  node_modules\.bin\tsc.CMD --noEmit
cd apps/web;  node_modules\.bin\vue-tsc.CMD --noEmit -p tsconfig.json   # 先看下方警告

# 测试（必须 --runInBand：多 worker 会因 spawn EPERM 失败）
cd apps/api;  node_modules\.bin\jest.CMD --runInBand

# 结构断言（连真实库）
cd apps/api;  node_modules\.bin\ts-node.CMD scripts/verify-schema.ts

# 契约自检（三个都要输出 SELFCHECK OK）
cd packages/prompt-manager
..\..\apps\api\node_modules\.bin\ts-node.CMD src/prompt-engine.selfcheck.ts
..\..\apps\api\node_modules\.bin\ts-node.CMD src/prompt-manager.selfcheck.ts
..\..\apps\api\node_modules\.bin\ts-node.CMD src/stages.selfcheck.ts

# 重建工作区包 dist（在仓库根执行；jest / nest / ts-node 运行时读 dist，tsc 类型检查读 src）
node_modules\.bin\tsc.CMD -p packages/shared/tsconfig.json
node_modules\.bin\tsc.CMD -p packages/shared/tsconfig.cjs.json
node_modules\.bin\tsc.CMD -p packages/prompt-manager/tsconfig.json
node_modules\.bin\tsc.CMD -p packages/ai-provider/tsconfig.json
```

⚠️ **`vue-tsc` 并不等于「不依赖 `.nuxt`」**：`apps/web/tsconfig.json` 首行是 `"extends": "./.nuxt/tsconfig.json"`，它**必须读**该文件，只是不重写它。干净 checkout 上 `.nuxt/` 不存在 → 必须先 `nuxt prepare`（web 包的 `postinstall` 就是它，但别依赖它一定被执行），再跑 `vue-tsc --noEmit`。选 `vue-tsc` 而非 `nuxt typecheck` 的理由仅是前者不写 `.nuxt/schema/*.json`（该目录在 Windows 上可能被权限挡住）。

其他已踩过的坑：

- **`psql -c` 里禁止中文字面量**（会报 `无效的 "UTF8" 编码字节顺序`）：要么纯 ASCII，要么写 UTF-8 的 `.sql` 文件用 `-f` 执行。psql 不在 PATH：`D:\Environment\PostgreSQL\18\bin\psql.exe`，密码取 `.env` 的 `DB_PASSWORD`。
- **`nuxt dev` 与 `playwright` 各需一次权限升级**：前者要 spawn esbuild，后者的浏览器守护进程写在工作区之外的 `%LOCALAPPDATA%`。
- **改前端样式/主题后硬刷新**：HMR 对 CSS 变量不一定即时生效。
- **删除文件在当前沙箱下常被拒**（根目录有一条「禁止删除子项」规则），需要删临时文件时请手工删。
- **`generation_tasks.attempts` 是「认领次数」**，不是 AI 调用次数；每次真实调用（含重试各一行）记在 `ai_generations`。

基线（2026-09-25 实测，改动后请对照）：`apps/api` `tsc --noEmit` exit 0 · `jest --runInBand` **16 suites / 91 tests 全绿** · `apps/web` `vue-tsc --noEmit` exit 0 · 三个契约自检 `SELFCHECK OK` · `verify-schema.ts` `SCHEMA OK`（26 条断言：0 个 NO ACTION 外键、19 个非唯一索引）· `packages/prompt-manager/dist` 中 0 个 `*selfcheck*` 产物。

---

## 构建与运行细节

### 后端 (`apps/api`)

- 入口：`apps/api/src/main.ts`
- 全局前缀：`/api`
- Swagger：`/api/docs`
- CORS：`process.env.WEB_URL` 或默认 `http://localhost:3001`（`credentials: true`）
- 全局管道：`ValidationPipe({ whitelist: true, transform: true })`
- 统一响应格式：`{ code: 200, data, message: 'success' }`（`TransformInterceptor`）
- 异常过滤：`GlobalExceptionFilter` 将异常统一为 `{ code, data: null, message }`
- TypeORM 实体采用**显式数组导入**（`database.config.ts`），未使用 glob，避免 ESM/CJS 问题。当前注册的实体（17 个）：`User`、`UserProfile`、`PortraitQuestion`、`PortraitAnswer`、`SkillTree`、`TreeNode`、`NodeContent`、`Exercise`、`CodeExample`、`GenerationTask`、`AiGeneration`、`LearningRecord`、`NodeLearningRecord`、`Recommendation`、`InterviewQuestion`、`AnalysisJob`、`SuggestedChange`。
  > 注意：`packages/shared` 中的 `GlobalConfig` 接口**没有**对应实体或模块，未注册。
- `synchronize: false`（**全环境关闭**）：schema 变更一律走迁移，不允许靠实体自动同步。当前 2 个迁移（`InitialSchema1789536289878`、`CascadeDeleteUserProfile1789537862755`）在 `config/database.config.ts` 中显式注册，CLI 入口是 `config/data-source.ts`；命令见「数据库迁移」。
- `bcryptjs` 用于密码哈希，避免 Windows 原生编译问题。
- NestJS 编译器使用 webpack（`nest-cli.json` 中 `webpack: true`）。

#### 实际 HTTP 端点（均带 `/api` 前缀，除 health 外都要求 JWT）

| 方法 | 路径 |
|------|------|
| GET | `/health` |
| POST | `/auth/register`、`/auth/login` |
| GET / PATCH | `/users/me` |
| GET | `/portrait/questions` |
| POST | `/portrait/submit` |
| POST | `/skill-trees/knowledge-points`、`/skill-trees` |
| GET / PATCH / DELETE | `/skill-trees/:id` |
| GET | `/nodes/:id/children`、`/nodes/:id`、`/nodes/:id/artifacts` |
| POST | `/nodes/:id/expand`、`/nodes/:id/content`（legacy，语义=确保 coreText）、`/nodes/:id/artifacts/:kind/generate`（`kind` ∈ `L3_CORE_TEXT`/`L3_CODE_EXAMPLES`/`L3_EXERCISES`，非法值 400） |
| POST | `/nodes/:id/regenerate`（节点级：重生成正文 + 作废下游产物）、`/nodes/:id/artifacts/:kind/regenerate`（单产物：已就绪的也允许换新） |
| GET / PATCH | `/nodes/:id/content`（legacy；GET 附 `artifacts` 状态字段） |
| PATCH / DELETE | `/nodes/:id` |
| GET / POST | `/learning-records` |
| PATCH / DELETE | `/learning-records/:id` |
| GET | `/skill-trees/:treeId/progress` |
| POST | `/skill-trees/:treeId/nodes/:nodeId/learning-status` |
| GET | `/dashboard` |
| GET | `/recommendations` |
| POST | `/recommendations/refresh`、`/recommendations/from-recommendation` |
| GET | `/skill-trees/:id/interview` |
| POST | `/skill-trees/:id/analysis` |
| GET | `/skill-trees/:id/analysis/suggestions` |
| POST | `/analysis/suggestions/:sid/apply`、`/analysis/suggestions/:sid/ignore` |

### 前端 (`apps/web`)

- 入口：`app.vue`
- 默认布局：`layouts/default.vue`（内容区 max-width 1200px 居中）
- 技能树页面布局：`layouts/fullscreen.vue`（`h-screen overflow-hidden`，技能树填满视口；`AppNav` 在该布局下自动铺满宽度）
- Tailwind v4 alpha 通过 `@tailwindcss/vite` 插件集成（`vite.plugins`）。
- API 基础地址来自运行时配置 `runtimeConfig.public.apiBaseUrl`（默认 `http://localhost:3002/api`）。
- 自动导入：`composables/**` 目录下的组合式函数会自动导入（`imports.dirs`）。
- 组件自动注册：`components/tree/` 下组件以 `Tree` 为前缀（如 `TreeVueFlowGraph`）。
- 其他依赖：`markdown-it` + `highlight.js`（L3 内容渲染）、`lucide-vue-next`（图标）、`dayjs`。

---

## 代码组织约定

### 共享包 (`packages/shared`)

单一可信来源：

- `src/enums/index.ts`：所有领域枚举（`TreeType`、`NodeLevel`、`NodeStatus`、`PortraitQuestionCategory`、`AnalysisType` 等）。
- `src/interfaces/entities.ts`：实体 TypeScript 接口。
- `src/interfaces/api.ts`：前后端实际共用的响应 DTO（`DashboardResponse`、`CurrentLearningItem`）；接口定义以实际消费为准，不预留未使用的 DTO。
- `src/constants/index.ts`：常量（当前仅 `MAX_RECOMMENDATIONS`）。
- `src/index.ts`：用 `export *` 转发 enums / interfaces / constants，新增枚举**无需**手工同步导出清单。

后端 TypeORM 实体与 `shared` 中的接口分别维护，字段名/含义需保持一致。

### AI Provider (`packages/ai-provider`)

- `IAIProvider` 接口：`chat(prompt, options?) => Promise<string>`。
- `DeepseekProvider`：基于 `openai` SDK，兼容 OpenAI 格式，`response_format: { type: 'json_object' }`。
- `MockProvider`：本地模拟返回，便于无 API key 开发。
- `AIProviderFactory.create(provider, options)`：仅 `DEEPSEEK`/`OPENAI` 走 DeepseekProvider；`ANTHROPIC` 当前未实现真实接入。

### Prompt Manager (`packages/prompt-manager`)

- 契约层（`src/prompt-engine.ts`）：`PromptTemplate` 带 `version` / `schema`（zod v4）/ `build` / `parse`；`defineTemplate()` 组装模板，并**由 schema 自动派生提示词里的「输出格式」段**（`outputFormatSection()` 走 `z.toJSONSchema`）——校验与提示词同源，不可能漂移。
- 失败归类：`AiContractError`（`invalid_json` / `truncated` / `schema_mismatch`，带字段级 `issues`）；`extractJson(raw)` 仍是语法层（去 Markdown 代码块 + 平衡括号扫描 + 截断判别）。`ai-integration` 统一在契约失败时把 issues 回灌模型重试一次。
- **写 schema 的约束**：必须保持 JSON-Schema 可表示（禁 `z.date()` / `z.transform()` / `z.custom()`）；跨字段不变量走 `invariants` 字段。
- 契约自检（`*.selfcheck.ts`，**已从 dist 排除、不随包发布**）：`prompt-engine.selfcheck.ts`、`prompt-manager.selfcheck.ts`、`stages.selfcheck.ts` —— 三个都要输出 `SELFCHECK OK`。
- `PromptManager.build(stage, input)` / `PromptManager.parse(stage, raw)` 是统一入口。
- 当前已实现的 stage（`src/templates/`）：
  - `knowledge-points`（stage 0）
  - `l1-outline`（stage 1）
  - `l2-nodes`（stage 2）
  - `l3-core-text`（stage 3a，只生成核心文本）
  - `l3-code-examples`（stage 3b，输入带 `coreText`，保证示例与讲解一致）
  - `l3-exercises`（stage 3c，输入带 `coreText`，避免考没讲过的内容）
  - `discover-new`（stage 4）
  - `check-expire`（stage 5）
  - `interview-qa`（stage 6）
  - `portrait`（stage 7）
  - `recommendations`（stage 8）
- 全部 11 个 stage 均已注册（阶段 4 把原 `l3-content` 拆成 3a/3b/3c，各自独立契约、独立失败与重试）。

---

## 设计与样式规范

设计系统来自 `docs/DESIGN.md` 与 `apps/web/assets/css/tailwind.css`。当前已凝练为一套**语义化颜色组块**，并在 `:root`（白天）与 `[data-theme="dark"]`（黑夜）两套变量下工作，通过 `data-theme` 属性切换。

### 语义化颜色 Token（同时支持亮/暗主题）

| Token | 白天值 | 黑夜值 | 用途 |
|-------|--------|--------|------|
| `--bg-canvas` | `#faf9f5` | `#131311` | 页面背景 |
| `--bg-surface` | `#ffffff` | `#1c1c19` | 卡片/输入框表面 |
| `--bg-elevated` | `#f0eee6` | `#252522` | 悬浮/选中背景 |
| `--text-primary` | `#141413` | `#f5f4ef` | 主文本 |
| `--text-secondary` | `#3d3d3a` | `#d8d7d0` | 次文本 |
| `--text-muted` | `#73726c` | `#a3a29b` | 辅助/占位文本 |
| `--border-default` | `#dedcd1` | `#363632` | 边框、分割线 |
| `--border-strong` | `#cdcbc1` | `#4a4a44` | 悬停/强调边框 |
| `--accent` | `#ccdbe8` | `#4a6fa5` | 唯一彩色强调 |
| `--accent-text` | `#1f1e1d` | `#e8f0f8` | 强调色上的文本 |
| `--danger` | `#c9372d` | `#ef4444` | 错误/删除 |
| `--success` | `#2d6a4f` | `#4ade80` | 成功 |

Tailwind `@theme` 中同时注册了语义类名（如 `bg-canvas`、`text-ink`、`border-border`、`bg-accent`）与兼容旧代码的别名（如 `bg-ivory-canvas`、`text-ink-black`、`border-linen-border`），因此旧组件在暗色模式下也能自动切换。

### 字体

| Token | 字体 | 用途 |
|-------|------|------|
| `--font-anthropic-serif` | Source Serif 4 | 标题 |
| `--font-anthropic-sans` | Plus Jakarta Sans | 正文/UI |

### 加载状态

- 通用骨架屏：`components/AppSkeleton.vue`，支持 `text` / `card` / `dashboard-cards` / `circle` 等变体。
- 仪表盘卡片骨架：`components/DashboardSkeletonCard.vue`，模拟真实卡片的标题行 + 描述行 + 底部条结构。
- 当前在仪表盘「我的技能树」「正在学习」「为你推荐」三个区块的 `loading` 状态统一使用骨架屏。

### 主题切换

- 状态管理：`composables/useTheme.ts`（Pinia store），支持 `light` / `dark` / `system` 三档。
- 切换入口：`components/ThemeToggle.vue`，挂载在 `AppNav` 右上角；当前为纯图标触发器，下拉选择主题。
- 持久化：`skill-theme` cookie（1 年）。
- 防闪屏：`app.vue` 在 `<head>` 中内联脚本，在首屏渲染前根据 cookie / 系统偏好设置 `data-theme`。

### 设计 Do / Don't

- 使用 Linen 1px 边框区分卡片，**不使用阴影**。
- 按钮圆角最大 9.6px，**不使用 pill 形状**。
- 标题使用衬线字体、轻字重（330–400），**避免 700+ 粗体**。
- 优先使用语义 token（`--bg-canvas`、`--text-primary`、`--border-default` 等），不直接写死 hex。
- Dust Blue / Deep Slate Blue 仅作轻量强调，**不作主按钮填充色**。
- 新增组件默认适配暗色主题；若无法适配，需在样式中通过 `[data-theme="dark"]` 单独处理。

---

## 测试策略

- 后端已有 Jest 单元测试（`apps/api/jest.config.js`，ts-jest，测试文件与源码同目录、以 `.spec.ts` 结尾）。当前 **16 suites / 91 tests 全绿**；命令见「本机 / DSH 沙箱下的执行方式」（沙箱内直接调 `apps/api/node_modules/.bin/jest.CMD --runInBand`，走 `pnpm --filter api test` 会 EPERM）。
- 当前覆盖的关键路径：
  - `modules/ai-integration/extract-json.spec.ts`：`@skill/prompt-manager` 的 `extractJson` 各类解析/失败分支；
  - `modules/recommendation/recommendation.service.spec.ts`：推荐 TTL 判断与「过期先返回、后台刷新」逻辑；
  - `modules/auth/auth.service.spec.ts`：注册/登录（含密码哈希校验与异常分支）；
  - `modules/analysis/analysis.service.spec.ts`：建议采纳（创建节点/标记过期）、状态约束、标题匹配与 AI 失败降级；
  - `modules/interview/interview.service.spec.ts`：按节点聚合分组、懒生成触发与并发去重、生成失败降级；
  - `modules/content/generation-task.service.spec.ts`：产物状态机的原子认领 SQL（含 `on conflict` 条件、120s 陈旧阈值、**force 重新认领**）、`markReady`/`markFailed` 语义；
  - `modules/content/artifact.service.spec.ts`：产物编排（幂等认领、coreText 前置依赖、失败标记并抛出、无 task 行时按内容兜底派生状态、**重新生成：version 递增 / 依赖产物作废 / 过期标记清回 ACTIVE**）。
  - 其余 9 个 suite（按文件名）：`tree-access.service`、`skill-tree.service`、`tree-node.service`、`content.service`、`ai-integration.service`、`ai-generation.service`、`provider-contract`、`database.config`、`learning-record/dto.spec`。
- 测试方式：直接 `new Service(...)` 传入 mock 依赖，不依赖 Nest 测试模块与真实数据库。
- 前端与 packages 下各包仍无测试；新增功能时应优先为纯逻辑、可确定的代码补测试（AI 生成内容本身不可测）。
- 日常验证以「本机 / DSH 沙箱下的执行方式」里的几条命令为辅（注意 pnpm 会 EPERM）；涉及页面/交互时手动跑 `pnpm dev`（需一次权限升级）。

---

## 安全与敏感信息

- 敏感值（DB 密码、JWT Secret、AI API Key）**只能**放在 `.env` 与运行时环境变量中，不得硬编码。
- AI Provider 配置已从数据库/设置页移除，**只读 `.env`**。
- JWT 通过 `Authorization: Bearer <token>` 传递；前端存在 `skill-token` cookie（7 天）。
- CORS 默认允许 `http://localhost:3001`，生产环境需设置 `WEB_URL`。
- TypeORM `synchronize: false`（全环境），schema 变更只能走迁移。生产环境需显式执行 `migration:run`——当前**没有**自动迁移入口/启动钩子。
- 当前没有 Docker、CI/CD、HTTPS 或部署脚本；本地开发时需注意端口与数据库安全。

---

## 常见任务与关键文件

| 任务 | 关键文件 |
|------|----------|
| 调整 API 入口/前缀/Swagger/CORS | `apps/api/src/main.ts` |
| 新增/修改数据库实体 | `apps/api/src/config/database.config.ts` + 对应 `entities/*.entity.ts` |
| 修改 AI 调用逻辑 | `apps/api/src/modules/ai-integration/ai-integration.service.ts` |
| 切换/调试 AI Provider | `packages/ai-provider/src/providers/mock.provider.ts` |
| 修改 Prompt | `packages/prompt-manager/src/templates/` |
| 前端 API 调用 | `apps/web/composables/useApi.ts` |
| 前端登录态 | `apps/web/composables/useAuthStore.ts` |
| 技能树布局计算 | `apps/web/composables/useTreeLayout.ts` |
| 技能树页面状态与交互 | `apps/web/composables/useSkillTreePage.ts` |
| 技能树页面 | `apps/web/pages/skills/[id]/tree.vue` |
| 面试模式（Q&A） | `apps/api/src/modules/interview/` + `apps/web/pages/skills/[id]/interview.vue` + `components/interview/` |
| AI 分析（新增/过期建议） | `apps/api/src/modules/analysis/` + `apps/web/components/analysis/AnalysisPanel.vue`（树页右上角「AI 分析」） |
| 设计 token / 主题切换 | `apps/web/assets/css/tailwind.css` + `composables/useTheme.ts` + `components/ThemeToggle.vue` |
| 设计系统文档 | `docs/DESIGN.md` |

---

## 已知限制与待办（基于实际代码）

1. **测试覆盖有限**：已建立 Jest 基建并覆盖 extractJson / 推荐 TTL / auth / analysis 建议流 / interview 懒生成 / 产物状态机与编排（见「测试策略」），其余模块仍无测试。
2. **推荐定时调度未实现**：用户访问时按需生成，TTL 3 天；已过期则先返回旧推荐并后台异步刷新（无 cron 预生成）。
3. **ANTHROPIC Provider 未接入**：`AIProviderType.ANTHROPIC` 在工厂中未实现真实调用。
4. **生产部署配置缺失**：没有 Dockerfile、docker-compose、CI/CD workflow 或部署脚本。
5. **analysis 按树分析（偏离设计文档）**：文档设计为按节点分析（POST /nodes/:id/analyze），实际实现为按树一键分析（POST /skill-trees/:id/analysis）；`TreeNode.keyPoints` 字段未回填；建议无「重新生成」入口。
6. **`OUTDATED_III` 仍无「删除节点」引导按钮**：过期节点已可通过「重新生成」修复（`OUTDATED_I`/`OUTDATED_II` 在重新生成成功后自动清回 `ACTIVE`），但 III 表示主题本身已淘汰，目前只在节点徽标与抽屉里文案提示「建议删除」，删除仍需走节点菜单。节点状态也**无法手动**改回（`UpdateNodeDto` 只允许 title/description）。
7. **审计无法显式区分「同一节点的第几版正文」**：`l3-core-text` 的输入不含旧正文，因此两版正文的首次尝试 `request_hash` 相同；要按版本追溯需给 `ai_generations` 加列（如 `node_content_version`）。代码示例/练习题同样没有版本号（`attempts` 只记认领次数）。
8. **interview 仍用内存 Map 去重**：产物生成已改为 `generation_tasks` 的库级原子认领（跨进程/重启安全），`interview.service.ts` 的并发去重仍是内存 `Map`，尚未迁移。

---

## 给 AI 助手的工作建议

- 修改工作区包后务必重新 build（命令见「本机 / DSH 沙箱下的执行方式」）并清理前端缓存。
- 新增后端模块时，记得在 `AppModule` 中导入，并在 `database.config.ts` 中注册新实体。
- 新增 Prompt stage 时，在 `packages/prompt-manager/src/prompt-manager.ts` 与 `src/index.ts` 中注册。
- 保持 `.env.example` 与代码同步；不要修改 `.env` 的内容结构而不更新示例。
- 样式改动优先通过 Tailwind token 变量完成，保持设计系统一致。
- 有测试（见「测试策略」）；改动后至少跑 `tsc --noEmit`、`jest --runInBand` 与三个契约自检（命令与基线见「本机 / DSH 沙箱下的执行方式」——**沙箱内 `pnpm <script>` 会 EPERM，别重试**），涉及页面/交互时再手动跑 `pnpm dev` 验证。
