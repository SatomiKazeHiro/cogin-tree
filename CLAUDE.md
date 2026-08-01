# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **skill tree learning platform** (技能树学习系统) implemented as a pnpm monorepo. It uses a Vue3/Nuxt3 frontend, a NestJS/TypeORM backend, and workspace packages for shared types, AI provider abstraction, and prompt management.

## Monorepo Structure

```
D:\MGit-Projects\cogni-tree
├── apps/
│   ├── web/                 # Nuxt 3 + Pinia + Tailwind CSS v4
│   └── api/                 # NestJS + TypeORM + PostgreSQL
├── packages/
│   ├── shared/              # Domain enums, entity interfaces, API DTOs
│   ├── ai-provider/         # IAIProvider + DeepSeek/OpenAI-compatible/Mock implementations
│   └── prompt-manager/      # Prompt templates and JSON parser
├── scripts/
│   └── dev.js               # Starts API + web with automatic port cleanup
├── docs/
│   ├── 系统架构设计.md
│   └── DESIGN.md
├── .env                     # DB, JWT, AI provider, ports (backend + tooling)
└── apps/web/.env            # NUXT_PUBLIC_API_BASE_URL (Nuxt reads its own .env)
```

## Common Development Commands

Run these from the repository root (`D:\MGit-Projects\cogni-tree`).

- Install dependencies: `pnpm install`
- Start both API and web dev servers: `pnpm dev`
  - Kills processes on ports 3001/3002, starts API, then web, forwards logs with `[api]`/`[web]` prefixes
- Start API only: `pnpm --filter api start:dev`
- Start web only: `pnpm --filter web dev`
- Build workspace packages: `pnpm --filter shared build && pnpm --filter ai-provider build && pnpm --filter prompt-manager build`
- API type-check: `pnpm --filter api typecheck`
- Web type-check: `pnpm --filter web typecheck`
- API tests: `pnpm --filter api test`
- Run a single API test: `pnpm --filter api test -- path/to/test.spec.ts`

## Development Environment

- PostgreSQL is expected on `localhost:5432` with credentials in `.env`.
- API runs on `API_PORT` from `.env` (currently `3002`).
- Web runs on `WEB_PORT` from `.env` (currently `3001`).
- `NUXT_PUBLIC_API_BASE_URL` must be set in `apps/web/.env` and match the API origin (e.g. `http://localhost:3002/api`).
- CORS is enabled in `apps/api/src/main.ts` using `WEB_URL` or `http://localhost:3001`.
- AI provider is read **only from `.env`** (`AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`). The DB-based config override and `/settings` AI form were removed.
- After changing `packages/shared`, rebuild it (`pnpm --filter shared build`) and delete `node_modules/.vite` + `apps/web/.nuxt` before restarting `pnpm dev`. Vite caches the CJS pre-bundle aggressively.

## High-Level Architecture

### Backend (`apps/api`)

- `AppModule` wires TypeORM (explicit entity list in `config/database.config.ts`), ConfigModule, JWT auth, and feature modules.
- `AuthModule` uses Passport JWT (`JwtStrategy`) and `bcryptjs` for password hashing.
- Feature modules:
  - `user` — user/profile CRUD
  - `portrait` — onboarding questions, AI portrait generation
  - `skill-tree` — create trees and auto-generate L1 nodes via AI
  - `tree-node` — expand L1 → L2 nodes
  - `content` — generate L3 content + code examples + exercises for L2 nodes
  - `learning-record` — track progress per skill tree
  - `recommendation` — on-demand personalized recommendations with per-user TTL
  - `dashboard` — aggregates learning records for the dashboard
  - `dashboard` — dashboard aggregation
  - `ai-integration` — single gateway to `@skill/ai-provider`; reads AI config from `.env`
- All controllers under `/api`.

### Workspace Packages

- `@skill/shared` — single source of truth for enums (`TreeType`, `NodeLevel`, `NodeStatus`, `PortraitQuestionCategory`, etc.) and DTO interfaces. Emits CJS; Vite pre-bundles it, so changes require cache invalidation.
- `@skill/ai-provider` — `IAIProvider` interface, `DeepseekProvider` (OpenAI-compatible), `MockProvider`, and `AIProviderFactory`.
- `@skill/prompt-manager` — stage-based prompt templates (1/2/3/7/8) with an `extractJson` parser.

### Frontend (`apps/web`)

- Nuxt 3 file-based routing with `layouts/default.vue`, `layouts/fullscreen.vue`, and `AppNav`.
- `useApi()` composable wraps `$fetch` against `apiBaseUrl` and unwraps `{ code, data, message }` responses.
- `useAuthStore()` (Pinia) manages JWT in a `skill-token` cookie and current user state.
- `middleware/auth.ts` redirects unauthenticated users to `/login`.
- Routes:
  - `/login`, `/register`
  - `/onboarding` — 4-step portrait questionnaire
  - `/dashboard` — skill trees + on-demand recommendations (only shown when portrait exists)
  - `/skills/create`
  - `/skills/:id/tree` — Vue Flow graph: root → L1 → L2 leaf nodes; L3 content shown in a right-side panel
  - `/settings` — user portrait reset only (AI provider config removed)

### Skill Tree Page (`/skills/:id/tree`)

- Implemented with `@vue-flow/core`.
- Layout is deterministic: root at x=0, L1 at x=320, L2 at x=640; each L1 occupies a vertical block sized to its L2 children.
- Nodes are fixed-height cards (`130px`); status is shown via badge + border color; no left status strip.
- L1 without children shows「初始化」; L2 without content shows「分析」; L2 with content shows「详情」and opens the right panel.
- The page uses `layouts/fullscreen.vue` and fills the viewport below the nav.

## Key Files for Common Tasks

- API entry: `apps/api/src/main.ts`
- Database config: `apps/api/src/config/database.config.ts`
- AI gateway: `apps/api/src/modules/ai-integration/ai-integration.service.ts`
- Mock AI provider: `packages/ai-provider/src/providers/mock.provider.ts`
- Prompt templates: `packages/prompt-manager/src/templates/`
- L3 content prompt: `packages/prompt-manager/src/templates/stage-3-l3-content.ts`
- Recommendation prompt: `packages/prompt-manager/src/templates/stage-8-recommendations.ts`
- API client: `apps/web/composables/useApi.ts`
- Auth store: `apps/web/composables/useAuthStore.ts`
- Tree layout: `apps/web/composables/useTreeLayout.ts`
- Design tokens: `apps/web/assets/css/tailwind.css`

## Design System

From `docs/DESIGN.md`:

- Page background: `#faf9f5` (Ivory Canvas)
- Card/input surface: `#ffffff` (Pure White)
- Primary text: `#141413` (Ink Black)
- Secondary text: `#1f1e1d` (Charcoal)
- Borders: `#dedcd1` (Linen)
- Accent: `#ccdbe8` (Dust Blue)
- Interactive radius: `9.6px`; cards: `16px`; containers: `24px`

Avoid drop shadows, pure black, pill-shaped buttons, bold headings, and extra chromatic colors.

## Notes

- TypeORM entity loading uses an explicit import list; glob loading was removed due to ESM/CJS issues.
- `bcryptjs` is used instead of `bcrypt` to avoid native compilation issues on Windows.
- Sensitive values (DB password, API keys, JWT secret) live only in `.env` and runtime environment.
- Nuxt reads environment variables from `apps/web/.env`, not the repo root `.env`; keep `NUXT_PUBLIC_API_BASE_URL` there.
- L3 content responses include `coreText`, `codeExamples`, and `exercises` (4-6 questions). Code examples are rendered between core text and exercises.
- Portrait questions support a custom text option emitted as `其他：<user input>`.
- Components in `apps/web/components/tree/` are auto-registered with a `Tree` prefix (e.g. `TreeVueFlowGraph`, `TreeL2ContentPanel`).
