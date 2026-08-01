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
- **工作区包**：`@skill/shared`（枚举/DTO）、`@skill/ai-provider`（AI Provider 抽象）、`@skill/prompt-manager`（Prompt 模板管理）。
- **包管理器**：pnpm 9.0.0（在根 `package.json` 的 `packageManager` 中锁定），要求 Node.js >= 20。
- **任务编排**：根目录使用 `turbo`（v2），但仓库中**没有 `turbo.json`**，依赖 Turbo 默认行为。

---

## 仓库结构

```
D:/MGit-Projects/cogni-tree
├── apps/
│   ├── api/                 # NestJS 后端（@skill/api）
│   └── web/                 # Nuxt 3 前端（@skill/web）
├── packages/
│   ├── shared/              # 共享枚举、实体接口、常量（@skill/shared）
│   ├── ai-provider/         # IAIProvider + DeepSeek/OpenAI-compatible/Mock 实现
│   └── prompt-manager/      # Prompt 模板与 JSON 解析器
├── scripts/
│   └── dev.js               # 同时启动 API + Web 开发服务器（先清理 3001/3002 端口）
├── docs/
│   ├── DESIGN.md            # 视觉/设计系统文档（英文）
│   └── 系统架构设计.md      # 系统架构与数据模型文档（中文）
├── .env                     # 本地环境变量（已 gitignore，参考 .env.example）
├── .env.example             # 环境变量示例
├── pnpm-workspace.yaml      # workspace: apps/*, packages/*
├── package.json             # 根脚本与 devDependencies
├── tsconfig.json            # 根 TypeScript 配置（供未独立 tsconfig 的包参考）
├── CLAUDE.md                # Claude Code 专用提示
└── AGENTS.md                # 本文件
```

### 后端模块 (`apps/api/src/modules/`)

| 模块 | 职责 |
|------|------|
| `auth` | JWT 注册/登录、`JwtStrategy`、`JwtAuthGuard` |
| `user` | 用户/用户画像（`User`、`UserProfile`）CRUD |
| `portrait` | 肖像问卷题目与提交、AI 生成肖像摘要、原始答案落库（`PortraitAnswer`） |
| `skill-tree` | 技能树（`SkillTree`）与 L1 节点（`TreeNode`）CRUD、自动生成 L1 |
| `tree-node` | 节点展开（生成 L2）、子节点查询、节点编辑删除 |
| `content` | L3 内容（`NodeContent`）与练习题（`Exercise`）的生成与查询 |
| `learning-record` | 用户与学习方向/节点的关联记录（`LearningRecord`、`NodeLearningRecord`） |
| `recommendation` | 推荐列表、按需刷新、从推荐创建技能树 |
| `dashboard` | 仪表盘数据聚合 |
| `ai-integration` | 统一调用 `@skill/ai-provider` 与 `@skill/prompt-manager`，从 `.env` 读取 AI 配置 |

其他后端要点：

- `apps/api/src/health/health.controller.ts`：健康检查端点。
- `apps/api/src/seeds/portrait-questions.seed.ts`：肖像问卷题目种子数据。
- `apps/api/src/common/`：全局异常过滤器（`GlobalExceptionFilter`）与响应转换拦截器（`TransformInterceptor`），在 `app.module.ts` 中通过 `APP_FILTER` / `APP_INTERCEPTOR` 注册。

注意：

- `analysis` 模块在设计文档（`docs/系统架构设计.md`）中有规划，但**当前代码中不存在**。
- 推荐定时调度（`recommendation-scheduler`）在文档中有设计，但**当前未实现**；推荐是按需生成（用户访问推荐接口时检查 3 天 TTL，见 `recommendation.service.ts` 的 `RECOMMENDATION_TTL_DAYS = 3`）。

### 前端结构 (`apps/web/`)

| 目录/文件 | 说明 |
|-----------|------|
| `pages/` | Nuxt 文件路由：`index`、`login`、`register`、`onboarding`、`dashboard`、`settings`、`skills/create`、`skills/[id]/tree` |
| `layouts/` | `default.vue`（常规页面，内容区 max-width 1200px）、`fullscreen.vue`（技能树全屏，`h-screen`，导航自动铺满宽度） |
| `components/tree/` | 技能树 Vue Flow 相关组件，按 `Tree` 前缀自动注册（如 `TreeVueFlowGraph`、`TreeDirectoryPanel`、`TreeL3Content`、`TreeExerciseCard`） |
| `components/dashboard/` | 仪表盘组件（如 `DashboardSkillCard`、`DashboardCurrentLearningSection`、`DashboardRecommendationSection`、`DashboardSkillTreeWizard`） |
| `components/portrait/` | 肖像问卷组件（`PortraitQuestionStep`、`PortraitSummary`、`PortraitProgressBar`） |
| `components/App*.vue` | 通用组件：`AppButton`、`AppCard`、`AppInput`、`AppNav`、`AppToast`、`AppConfirmDialog`、`AppSkeleton` |
| `components/UserMenu.vue` | 右上角用户菜单（设置/退出） |
| `components/ThemeToggle.vue` | 主题切换按钮 |
| `components/DashboardSkeletonCard.vue` | 仪表盘卡片骨架屏 |
| `components/EmptyState.vue` | 空状态占位组件 |
| `composables/` | `useApi`、`useAuthStore`、`useTreeLayout`、`useSkillTreePage`、`usePageHeader`、`useToast`、`useConfirm`、`useTheme` |
| `utils/learning-status.ts` | 学习状态相关的纯函数工具 |
| `middleware/auth.ts` | 未登录用户重定向到 `/login`（`skill-token` cookie） |
| `assets/css/tailwind.css` | Tailwind v4 主题与设计 token |

注：`stores/` 与 `types/` 目录当前为空（状态管理实际通过 `composables/` 中的 Pinia store 完成）。

---

## 环境要求

- **Node.js**：>= 20
- **包管理器**：pnpm 9.0.0（在 `package.json` 的 `packageManager` 中锁定）
- **数据库**：PostgreSQL，默认 `localhost:5432`
- **AI Provider**：DeepSeek（默认）或 Mock；需要有效的 `AI_API_KEY` 才能调用真实模型

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
# 当前仓库没有任何 .spec/.test 文件；`pnpm test` 会调用 turbo run test

# Lint（仅 apps/api 配置了 eslint）
pnpm lint
```

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
- TypeORM 实体采用**显式数组导入**（`database.config.ts`），未使用 glob，避免 ESM/CJS 问题。当前注册的实体：`User`、`UserProfile`、`GlobalConfig`、`PortraitQuestion`、`PortraitAnswer`、`SkillTree`、`TreeNode`、`NodeContent`、`Exercise`、`LearningRecord`、`NodeLearningRecord`、`Recommendation`。
- `synchronize: true` 仅在 `NODE_ENV !== 'production'` 时启用。
- `bcryptjs` 用于密码哈希，避免 Windows 原生编译问题。
- NestJS 编译器使用 webpack（`nest-cli.json` 中 `webpack: true`）。

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

后端 TypeORM 实体与 `shared` 中的接口分别维护，字段名/含义需保持一致。

### AI Provider (`packages/ai-provider`)

- `IAIProvider` 接口：`chat(prompt, options?) => Promise<string>`。
- `DeepseekProvider`：基于 `openai` SDK，兼容 OpenAI 格式，`response_format: { type: 'json_object' }`。
- `MockProvider`：本地模拟返回，便于无 API key 开发。
- `AIProviderFactory.create(provider, options)`：仅 `DEEPSEEK`/`OPENAI` 走 DeepseekProvider；`ANTHROPIC` 当前未实现真实接入。

### Prompt Manager (`packages/prompt-manager`)

- `PromptTemplate<TInput, TOutput>` 接口：`version`、`build(input)`、`parse(raw)`。
- `PromptManager.build(stage, input)` / `PromptManager.parse(stage, raw)` 是统一入口。
- `extractJson(raw)` 会去除 Markdown 代码块后 `JSON.parse`。
- 当前已实现的 stage（`src/templates/`）：
  - `knowledge-points`（stage 0）
  - `l1-outline`（stage 1）
  - `l2-nodes`（stage 2）
  - `l3-content`（stage 3）
  - `portrait`（stage 7）
  - `recommendations`（stage 8）
- stage 4（新增分析）与 stage 5（过期分析）在设计文档中存在，但**当前未实现**。

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

- 当前仓库**没有任何单元测试、集成测试或 E2E 测试文件**。
- `apps/api/package.json` 已配置 Jest，命令为 `pnpm --filter api test`。
- 新增功能时应补充对应测试；后端测试工具链已就绪（`@nestjs/testing`、`supertest`、`ts-jest`）。
- 当前测试主要通过 `pnpm typecheck` 与手动运行 `pnpm dev` 验证。

---

## 安全与敏感信息

- 敏感值（DB 密码、JWT Secret、AI API Key）**只能**放在 `.env` 与运行时环境变量中，不得硬编码。
- AI Provider 配置已从数据库/设置页移除，**只读 `.env`**。
- JWT 通过 `Authorization: Bearer <token>` 传递；前端存在 `skill-token` cookie（7 天）。
- CORS 默认允许 `http://localhost:3001`，生产环境需设置 `WEB_URL`。
- TypeORM 在非生产环境启用 `synchronize: true`，生产环境务必关闭并改用迁移。
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
| 设计 token / 主题切换 | `apps/web/assets/css/tailwind.css` + `composables/useTheme.ts` + `components/ThemeToggle.vue` |
| 设计系统文档 | `docs/DESIGN.md` |

---

## 已知限制与待办（基于实际代码）

1. **没有 `turbo.json`**：`turbo run build/lint/test/typecheck` 使用默认配置；如需自定义缓存/依赖，应新增该文件。
2. **没有测试**：需要从零建立测试覆盖。
3. **`analysis` 模块未实现**：设计文档中的节点新增/过期分析、建议列表、采纳/忽略功能当前不存在。
4. **Stage 4/5 Prompt 未实现**：`prompt-manager` 只注册了 stage 0/1/2/3/7/8。
5. **推荐定时调度未实现**：当前是用户访问时按需生成，TTL 3 天。
6. **ANTHROPIC Provider 未接入**：`AIProviderType.ANTHROPIC` 在工厂中未实现真实调用。
7. **生产部署配置缺失**：没有 Dockerfile、docker-compose、CI/CD workflow 或部署脚本。

---

## 给 AI 助手的工作建议

- 修改工作区包后务必重新 build 并清理前端缓存。
- 新增后端模块时，记得在 `AppModule` 中导入，并在 `database.config.ts` 中注册新实体。
- 新增 Prompt stage 时，在 `packages/prompt-manager/src/prompt-manager.ts` 与 `src/index.ts` 中注册。
- 保持 `.env.example` 与代码同步；不要修改 `.env` 的内容结构而不更新示例。
- 样式改动优先通过 Tailwind token 变量完成，保持设计系统一致。
- 不要假设已有测试；改动后请手动跑 `pnpm typecheck` 与 `pnpm dev` 验证。
