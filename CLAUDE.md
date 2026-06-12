# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **skill tree learning platform** (技能树学习系统) implemented as a pnpm monorepo. It uses a Vue3/Nuxt3 frontend, a NestJS/TypeORM backend, and workspace packages for shared types, AI provider abstraction, and prompt management.

## Monorepo Structure

```
D:\MGit-Projects\study-by-ai
├── apps/
│   ├── web/                 # Nuxt 3 + Pinia + Tailwind CSS v4
│   └── api/                 # NestJS + TypeORM + PostgreSQL
├── packages/
│   ├── shared/              # Domain enums, entity interfaces, API DTOs
│   ├── ai-provider/         # IAIProvider + DeepSeek/OpenAI/Mock implementations
│   └── prompt-manager/      # Prompt templates and JSON parser
├── docs/
│   ├── 系统架构设计.md
│   └── DESIGN.md
└── .env                     # DB, JWT, AI provider, ports
```

## Common Development Commands

Run these from the repository root (`D:\MGit-Projects\study-by-ai`).

- Install dependencies: `pnpm install`
- Start API dev server: `pnpm --filter api start:dev`
- Start web dev server: `pnpm --filter web dev`
- Build shared packages: `pnpm --filter shared build` / `ai-provider` / `prompt-manager`
- API type-check: `pnpm --filter api typecheck`
- Web type-check: `pnpm --filter web typecheck`
- API tests: `pnpm --filter api test`
- Run a single API test: `pnpm --filter api test -- path/to/test.spec.ts`

## Development Environment

- PostgreSQL is expected on `localhost:5432` with credentials in `.env`.
- API runs on `API_PORT` from `.env` (currently `3002`).
- Web runs on `WEB_PORT` from `.env` (currently `3001`).
- `NUXT_PUBLIC_API_BASE_URL` in `.env` must match the API origin.
- CORS is enabled in `apps/api/src/main.ts` using `WEB_URL` or `http://localhost:3001`.
- AI provider defaults to `mock` for local development (no API key required).

## High-Level Architecture

### Backend (`apps/api`)

- `AppModule` wires TypeORM (explicit entity list in `config/database.config.ts`), ConfigModule, JWT auth, and feature modules.
- `AuthModule` uses Passport JWT (`JwtStrategy`) and `bcryptjs` for password hashing.
- Feature modules:
  - `user` — user/profile CRUD
  - `portrait` — onboarding questions, AI portrait generation
  - `skill-tree` — create trees and auto-generate L1 nodes via AI
  - `tree-node` — expand L1 → L2 nodes
  - `content` — generate L3 content + exercises for L2 nodes
  - `learning-record` — track progress per skill tree
  - `config` — read/write global AI provider settings
  - `ai-integration` — single gateway to `@skill/ai-provider`
- All controllers under `/api`.

### Workspace Packages

- `@skill/shared` — single source of truth for enums (`TreeType`, `NodeLevel`, `NodeStatus`, `PortraitQuestionCategory`, etc.) and DTO interfaces.
- `@skill/ai-provider` — `IAIProvider` interface, `DeepseekProvider` (OpenAI-compatible), `MockProvider`, and `AIProviderFactory`.
- `@skill/prompt-manager` — stage-based prompt templates (1/2/3/7 in MVP) with an `extractJson` parser.

### Frontend (`apps/web`)

- Nuxt 3 file-based routing with `layouts/default.vue` and `AppNav`.
- `useApi()` composable wraps `$fetch` against `apiBaseUrl` and unwraps `{ code, data, message }` responses.
- `useAuthStore()` (Pinia) manages JWT in a `skill-token` cookie and current user state.
- `middleware/auth.ts` redirects unauthenticated users to `/login`.
- Routes:
  - `/login`, `/register`
  - `/onboarding` — 4-step portrait questionnaire
  - `/dashboard` — skill trees + mock recommendations
  - `/skills/create`
  - `/skills/:id/tree` — L1 → L2 → L3 learning view
  - `/settings` — AI provider configuration

## Key Files for Common Tasks

- API entry: `apps/api/src/main.ts`
- Database config: `apps/api/src/config/database.config.ts`
- AI gateway: `apps/api/src/modules/ai-integration/ai-integration.service.ts`
- Mock AI provider: `packages/ai-provider/src/providers/mock.provider.ts`
- Prompt templates: `packages/prompt-manager/src/templates/`
- API client: `apps/web/composables/useApi.ts`
- Auth store: `apps/web/composables/useAuthStore.ts`
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
