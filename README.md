# 技能树学习系统

一个基于 AI 的个性化技能树学习平台。用户通过肖像问卷描述自己的身份、兴趣与目标，系统据此生成学习方向推荐；用户可以创建技能树，AI 会自动梳理 L1/L2 知识点并生成 L3 学习内容（概念、代码演示、练习题），同时支持标记每个节点的学习状态。

---

## 功能特性

- **用户与认证**：JWT 注册/登录，Cookie 持久化登录态。
- **肖像问卷**：身份/兴趣/目标/背景四类选择题，AI 生成用户肖像摘要。
- **学习仪表盘**：
  - 我的技能树
  - 正在学习（展示进度与最近学习节点）
  - 为你推荐
- **技能树可视化**：基于 `@vue-flow/core` 的交互式树图，支持：
  - 左侧可折叠目录
  - 节点展开/收起（右侧 +/- 按钮）
  - L2 节点右侧抽屉展示学习内容
  - 节点学习状态标记
- **AI 内容生成**：自动生成 L1 大纲、L2 节点、L3 核心文本/代码示例/练习题。
- **学习状态**：节点可标记为未开始/学习中/已完成/跳过，仪表盘同步展示。
- **明暗主题**：支持 light / dark / system 三档切换，自动持久化。

---

## 技术栈

- **前端**：Vue 3 + Nuxt 3 + Pinia + Tailwind CSS v4（alpha）+ `@vue-flow/core`
- **后端**：NestJS + TypeORM + PostgreSQL + Passport JWT
- **工作区包**：
  - `@skill/shared`：共享枚举、实体接口、API DTO
  - `@skill/ai-provider`：AI Provider 抽象与实现
  - `@skill/prompt-manager`：Prompt 模板与 JSON 解析
- **包管理器**：pnpm 9.0.0
- **Node.js**：>= 20

---

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，并填写数据库、JWT、AI Provider 等信息：

```bash
cp .env.example .env
```

同时创建前端环境变量文件 `apps/web/.env`：

```bash
# apps/web/.env
NUXT_PUBLIC_API_BASE_URL=http://localhost:3002/api
```

> 注意：Nuxt 不会读取仓库根目录的 `.env`，`NUXT_PUBLIC_API_BASE_URL` 必须放在 `apps/web/.env` 中。

### 3. 启动数据库

确保 PostgreSQL 已运行，并创建对应数据库（默认 `skill_learning`）。

### 4. 启动开发服务器

```bash
pnpm dev
```

该命令会同时启动 API（默认 3002）和 Web（默认 3001）开发服务器，并自动清理占用端口。

也可以单独启动：

```bash
pnpm --filter api start:dev
pnpm --filter web dev
```

### 5. 访问

- Web：http://localhost:3001
- API：http://localhost:3002/api
- Swagger：http://localhost:3002/api/docs

---

## 常用命令

```bash
# 类型检查
pnpm typecheck
pnpm --filter api typecheck
pnpm --filter web typecheck

# 构建
pnpm build

# 运行测试（当前暂无测试文件）
pnpm test

# Lint
pnpm lint

# 重新构建工作区包（修改 @skill/shared 后必须执行）
pnpm --filter shared build
pnpm --filter ai-provider build
pnpm --filter prompt-manager build
```

---

## 项目结构

```
.
├── apps/
│   ├── api/                 # NestJS 后端
│   └── web/                 # Nuxt 3 前端
├── packages/
│   ├── shared/              # 共享枚举、实体接口、常量
│   ├── ai-provider/         # AI Provider 抽象与实现
│   └── prompt-manager/      # Prompt 模板管理
├── scripts/
│   └── dev.js               # 同时启动 API + Web
├── docs/
│   ├── DESIGN.md            # 视觉/设计系统文档
│   ├── 系统架构设计.md       # 系统架构与数据模型
│   └── *.jpg                # 设计/架构示意图
├── .env.example             # 环境变量示例
├── pnpm-workspace.yaml      # pnpm workspace 配置
└── README.md                # 本文件
```

---

## 环境变量说明

### 根目录 `.env`

| 变量 | 说明 | 示例 |
|------|------|------|
| `DB_HOST` | PostgreSQL 主机 | `localhost` |
| `DB_PORT` | PostgreSQL 端口 | `5432` |
| `DB_USERNAME` | 数据库用户名 | `postgres` |
| `DB_PASSWORD` | 数据库密码 | `` |
| `DB_DATABASE` | 数据库名 | `skill_learning` |
| `JWT_SECRET` | JWT 签名密钥 | `change-me-in-production` |
| `JWT_EXPIRES_IN` | JWT 有效期 | `7d` |
| `AI_PROVIDER` | AI Provider | `deepseek` / `openai` / `mock` |
| `AI_API_KEY` | AI API 密钥 | `` |
| `AI_MODEL` | 模型名称 | `deepseek-chat` |
| `AI_BASE_URL` | API 基础地址 | `https://api.deepseek.com` |
| `AI_L3_MAX_TOKENS` | L3 内容生成 max_tokens | `4096` |
| `API_PORT` | 后端端口 | `3002` |
| `WEB_PORT` | 前端端口（dev.js 使用） | `3001` |

### 前端 `apps/web/.env`

| 变量 | 说明 | 示例 |
|------|------|------|
| `NUXT_PUBLIC_API_BASE_URL` | 后端 API 地址 | `http://localhost:3002/api` |

---

## 开发注意事项

- 修改 `packages/shared` 后，必须重新 build 并清理前端缓存，否则可能拿到旧类型：

  ```bash
  pnpm --filter shared build
  rm -rf node_modules/.vite apps/web/.nuxt
  pnpm dev
  ```

- AI Provider 配置只读取 `.env`，不再从数据库/设置页读取。
- TypeORM 在非生产环境启用 `synchronize: true`，生产环境请关闭并改用迁移。
- 当前仓库没有单元测试/E2E 测试；`pnpm test` 会调用 turbo run test。

---

## 相关文档

- [DESIGN.md](./docs/DESIGN.md) — 视觉与设计系统
- [系统架构设计.md](./docs/系统架构设计.md) — 系统架构与数据模型
- [AGENTS.md](./AGENTS.md) — AI 助手项目指南

---

## License

MIT
