# 计划 A 实施计划：表结构地基 + 授权收口（阶段 1–2）

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把数据库 schema 重建为设计文档第 5 节的目标结构（17 张表、类型修正、索引、唯一约束、级联、私有归属），并给所有树/节点相关端点补上 owner 授权与 DTO 收口。

**Architecture:** 先建立迁移基建（`DataSource` + migrations 目录 + `synchronize: false`），把目标 schema 一次性写成 `InitialSchema` 初始迁移（因为库内 100% 是测试数据，走干净重建）；再从实体改造入手让代码适配新 schema；最后用一个独立的 schema 断言脚本作为该阶段的验收测试，授权与 DTO 作为第二阶段收口。

**Tech Stack:** NestJS 10 · TypeORM 0.3.20 · PostgreSQL 18.4 · ts-jest（单测，不连库）· ts-node + TypeORM CLI（迁移）· pnpm 9.0.0

**Spec:** `docs/specs/2026-09-16-ai-contract-and-dataflow-design.md`

## Global Constraints

- Node.js >= 20；pnpm 9.0.0（`packageManager` 锁定）
- **本计划不新增任何 npm 依赖**（zod 属于计划 B/阶段 3，届时需要一次写权限升级，见「环境注意」）
- 沙箱内 pnpm 需覆盖 `PNPM_HOME` 才能运行：`$env:PNPM_HOME = Join-Path (Get-Location) ".pnpm-home"`
- 单测一律**不连库**：直接 `new Service(...)` 传 mock 依赖（沿用 `apps/api/jest.config.js` 与现有 spec 风格）
- 测试命令（沙箱内必须 `--runInBand`，否则 jest worker `spawn EPERM`）：
  `cd apps/api; node_modules\.bin\jest --runInBand`
- 类型检查：`cd apps/api; node_modules\.bin\tsc --noEmit`
- 迁移 CLI（绕开 pnpm）：`apps/api/node_modules/.bin/typeorm-ts-node-commonjs`
- 目标表数 **17**；`synchronize` 必须为 `false`
- 授权语义：不存在 → 404；存在但非本人 → **403**（`ForbiddenException`）
- 提交信息沿用仓库风格：`<emoji> <type>: <中文描述>`
- **每个阶段（Phase）末尾单独提交一个阶段收尾 commit**（用户要求按进度分批提交）

### 环境注意（务必先读）

1. **pnpm 全局目录被沙箱拒写**。任何 pnpm 命令前先执行：
   `$env:PNPM_HOME = Join-Path (Get-Location) ".pnpm-home"`
2. **pnpm store 在工作区外**（`D:\.pnpm-store\v3`）。计划 B 装 zod 时该目录会被拒写，届时对**同一条命令**发起一次 `sandbox_permissions` 升级即可。
3. **`psql -c` 里禁止写中文字面量**：控制台以 GBK 送入，psql 会报「无效的 UTF8 编码字节顺序」。需要中文时用 `-f` 执行 UTF-8 脚本文件，或改用 `chr()`。
4. 库连接参数：`localhost:5432`，库名 `skill_learning`，凭据在根 `.env`。
5. 备份已就绪，不要重复做：`backups/2026-09-16-full-db/`（全库）、`backups/2026-09-16-orphan-trees/`（孤儿树）。
6. **`@skill/*` 有两条不同解析路径，必须同时满足**：
   - `apps/api/tsconfig.json` 的 `paths` 把 `@skill/*` 指向 `packages/*/src` → **`tsc --noEmit` 读源码**，改了 `packages/shared/src` 后类型检查立刻生效
   - 但 **jest / ts-node / nest 运行时**按 `node_modules` 解析 → **走 `packages/*/dist`**
   - 结论：任何改动 `packages/shared/src` 的步骤（如 Task 5 加枚举）**必须执行 `pnpm --filter shared build`**，否则测试与脚本会在运行时看不到新导出（`tsc` 却会通过，极易误判）
7. `apps/api/scripts/verify-schema.ts` **不在 `tsconfig.json` 的 `include`（仅 `src/**/*`）内**，因此 `tsc --noEmit` 不会检查它；它的正确性只能靠实际运行 `ts-node scripts/verify-schema.ts` 验证。若希望纳入类型检查，可另行把 `include` 扩为 `["src/**/*", "scripts/**/*"]`（本计划不做，避免影响 `nest build` 产物结构）。
8. `apps/api/tsconfig.json` 开了 `strictNullChecks` 与 `noImplicitAny`，但**没有开 `strict`**；本计划各代码块已按此约束编写。

---

## File Structure

### 新增

| 文件 | 职责 |
|---|---|
| `apps/api/src/config/data-source.ts` | TypeORM CLI 用 `DataSource`（迁移 generate/run/revert 入口） |
| `apps/api/src/migrations/<ts>-InitialSchema.ts` | 目标 schema 的初始迁移（由 CLI 从实体生成后人工评审） |
| `apps/api/src/modules/content/entities/code-example.entity.ts` | `code_examples` 表实体（对称归一化） |
| `apps/api/src/modules/ai-integration/entities/ai-generation.entity.ts` | `ai_generations` 审计表实体（阶段 3 才写入） |
| `apps/api/src/modules/content/entities/generation-task.entity.ts` | `generation_tasks` 产物状态实体（阶段 4 才使用） |
| `apps/api/src/modules/tree-access/tree-access.module.ts` | 导出 `TreeAccessService` 的模块 |
| `apps/api/src/modules/tree-access/tree-access.service.ts` | 归属校验单一实现（`assertTreeOwner` / `assertNodeOwner`） |
| `apps/api/src/modules/tree-access/tree-access.service.spec.ts` | 归属校验单测 |
| `apps/api/src/modules/content/dto/update-node-content.dto.ts` | 替代裸类型 body |
| `apps/api/src/modules/tree-node/dto/update-node.dto.ts` | 替代裸类型 body |
| `apps/api/src/modules/learning-record/dto/create-learning-record.dto.ts` | 替代裸类型 body |
| `apps/api/src/modules/learning-record/dto/update-node-learning-status.dto.ts` | 替代裸类型 body |
| `apps/api/src/modules/recommendation/dto/from-recommendation.dto.ts` | 替代裸类型 body |
| `apps/api/scripts/verify-schema.ts` | schema 断言脚本（本计划的验收测试） |
| `apps/api/src/modules/skill-tree/skill-tree.service.spec.ts` | skill-tree 服务单测（含归属） |
| `apps/api/src/modules/content/content.service.spec.ts` | content 服务单测（含 code_examples 落库与归属） |
| `apps/api/src/modules/tree-node/tree-node.service.spec.ts` | tree-node 服务单测（含归属） |

### 修改

| 文件 | 变更 |
|---|---|
| `apps/api/src/config/database.config.ts` | `synchronize: false`；注册 3 个新实体；注册 migrations |
| `apps/api/package.json` | 新增 `migration:generate` / `migration:run` / `migration:revert` / `schema:verify` 脚本 |
| `apps/api/src/modules/skill-tree/entities/skill-tree.entity.ts` | +`ownerId`（NOT NULL + FK CASCADE）、+索引 |
| `apps/api/src/modules/skill-tree/skill-tree.service.ts` | `create` 写入 owner；`findById`/`update`/`remove` 加归属；`remove` 用级联简化 |
| `apps/api/src/modules/content/entities/node-content.entity.ts` | 删 `codeExamples` json 列；+`codeExamples` 关系；`nodeId` 级联 |
| `apps/api/src/modules/content/content.service.ts` | codeExamples 改为读写子表；三个方法加归属校验 |
| `apps/api/src/modules/content/content.controller.ts` | 传 userId；`@Body` 换 DTO |
| `apps/api/src/modules/skill-tree/entities/tree-node.entity.ts` | `tree_id`/`parent_id` 级联 CASCADE；+3 个索引 |
| `apps/api/src/modules/learning-record/entities/learning-record.entity.ts` | 类型 uuid + 双 FK CASCADE + 唯一约束 + 索引 |
| `apps/api/src/modules/learning-record/entities/node-learning-record.entity.ts` | 类型 uuid + 三 FK CASCADE + 唯一约束 + 索引 |
| `apps/api/src/modules/recommendation/entities/recommendation.entity.ts` | `user_id` uuid + FK；`skill_tree_id` FK SET NULL；+索引 |
| `apps/api/src/modules/analysis/entities/suggested-change.entity.ts` | 两个节点列 uuid + FK SET NULL；+索引 |
| `apps/api/src/modules/portrait/entities/portrait-answer.entity.ts` | `question_id` 级联 CASCADE |
| `apps/api/src/modules/user/entities/user-profile.entity.ts` | +`portraitSchemaVersion` |
| `apps/api/src/modules/tree-node/tree-node.service.ts` | 五个方法加归属校验 |
| `apps/api/src/modules/tree-node/tree-node.controller.ts` | 传 userId；`@Body` 换 DTO |
| `apps/api/src/modules/interview/interview.service.ts` | `findForTree` 加归属校验 |
| `apps/api/src/modules/analysis/analysis.service.ts` | 四个方法加归属校验 |
| `apps/api/src/modules/learning-record/learning-record.controller.ts` | `@Body` 换 DTO |
| `apps/api/src/modules/learning-record/learning-record.service.ts` | `create` 校验树归属 |
| `apps/api/src/modules/learning-record/node-learning-record.service.ts` | `updateStatus` 校验树归属 |
| `apps/api/src/modules/learning-record/node-learning-record.controller.ts` | `@Body` 换 DTO；校验树归属 |
| `apps/api/src/modules/recommendation/recommendation.controller.ts` | `@Body` 换 DTO |
| `apps/api/src/app.module.ts` | 注册 `TreeAccessModule` |

---

# 阶段 1：表结构地基

## Task 1: 迁移基建

**Files:**
- Create: `apps/api/src/config/data-source.ts`
- Create: `apps/api/src/config/database.config.spec.ts`
- Modify: `apps/api/src/config/database.config.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Consumes: 现有 `databaseConfig(): TypeOrmModuleOptions`
- Produces: `default export DataSource`（供 CLI）；`databaseConfig()` 返回 `synchronize: false`

- [ ] **Step 1: 写失败测试**

创建 `apps/api/src/config/database.config.spec.ts`：

```ts
import { databaseConfig } from './database.config';

describe('databaseConfig', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('关闭 synchronize（schema 变更只能走 migration）', () => {
    expect(databaseConfig().synchronize).toBe(false);
  });

  it('在 production 下同样关闭 synchronize', () => {
    process.env.NODE_ENV = 'production';
    expect(databaseConfig().synchronize).toBe(false);
  });

  it('显式注册实体（不使用 glob）', () => {
    const entities = databaseConfig().entities as unknown[];
    expect(Array.isArray(entities)).toBe(true);
    expect(entities.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/config
```
Expected: FAIL —`synchronize` 当前是 `true`（非 production）。

- [ ] **Step 3: 实现 —— 关闭 synchronize**

修改 `apps/api/src/config/database.config.ts` 的 `return` 块：

```ts
    // schema 变更一律走 migration（见 apps/api/src/migrations/）
    synchronize: false,
    migrations: [],
    logging: process.env.NODE_ENV === 'development',
```
（`migrations: []` 在 Task 12 追加初始迁移时填充）

- [ ] **Step 4: 跑测试确认通过**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/config
```
Expected: PASS（3 个用例）

- [ ] **Step 5: 创建 CLI 用 DataSource**

创建 `apps/api/src/config/data-source.ts`：

```ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { databaseConfig } from './database.config';

/**
 * TypeORM CLI 入口（migration:generate / migration:run / migration:revert）。
 * 环境变量由调用方通过 .env 或 shell 提供，本文件不做 env 加载。
 */
const options = databaseConfig();

export default new DataSource({
  type: 'postgres',
  host: options.host as string,
  port: options.port as number,
  username: options.username as string,
  password: options.password as string,
  database: options.database as string,
  entities: options.entities as never,
  migrations: options.migrations as never,
  synchronize: false,
});
```

- [ ] **Step 6: 加 npm 脚本**

在 `apps/api/package.json` 的 `scripts` 中新增：

```json
    "typeorm": "typeorm-ts-node-commonjs -d src/config/data-source.ts",
    "migration:generate": "npm run typeorm -- migration:generate",
    "migration:run": "npm run typeorm -- migration:run",
    "migration:revert": "npm run typeorm -- migration:revert",
    "schema:verify": "ts-node scripts/verify-schema.ts"
```

- [ ] **Step 7: 类型检查 + 提交**

```powershell
cd apps/api; node_modules\.bin\tsc --noEmit
git add apps/api/src/config apps/api/package.json
git commit -m "🔧 chore: 迁移基建（DataSource + migrations 注册 + 关闭 synchronize）"
```

---

## Task 2: `skill_trees.owner_id` 与创建时写入

**Files:**
- Modify: `apps/api/src/modules/skill-tree/entities/skill-tree.entity.ts`
- Modify: `apps/api/src/modules/skill-tree/skill-tree.service.ts`
- Create: `apps/api/src/modules/skill-tree/skill-tree.service.spec.ts`

**Interfaces:**
- Consumes: `SkillTreeService.create(data, userId)` 的既有 `userId` 参数
- Produces: `SkillTree.ownerId: string`；`create` 落库时带 `ownerId`

- [ ] **Step 1: 写失败测试**

创建 `apps/api/src/modules/skill-tree/skill-tree.service.spec.ts`：

```ts
import { SkillTreeService } from './skill-tree.service';
import { TreeType } from '@skill/shared';

describe('SkillTreeService.create（写入归属）', () => {
  let service: SkillTreeService;
  let treeRepo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock };
  let nodeRepo: { create: jest.Mock; save: jest.Mock; find: jest.Mock };
  let recordRepo: { create: jest.Mock; save: jest.Mock };
  let aiService: { generateL1: jest.Mock; generateL1FromPoints: jest.Mock };

  beforeEach(() => {
    treeRepo = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ ...v, id: 'tree-1' })),
      findOne: jest.fn(async () => ({
        id: 'tree-1',
        name: '前端工程化',
        ownerId: 'user-1',
        nodes: [],
      })),
    };
    nodeRepo = { create: jest.fn((v) => v), save: jest.fn(async (v) => v), find: jest.fn() };
    recordRepo = { create: jest.fn((v) => v), save: jest.fn(async (v) => v) };
    aiService = {
      generateL1: jest.fn(async () => ({ nodes: [{ title: 'A', description: 'a' }] })),
      generateL1FromPoints: jest.fn(),
    };
    service = new SkillTreeService(
      treeRepo as never,
      nodeRepo as never,
      recordRepo as never,
      aiService as never,
    );
  });

  it('创建技能树时写入 ownerId = 当前用户', async () => {
    await service.create({ name: '前端工程化', type: TreeType.ENTRY }, 'user-1');

    expect(treeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: '前端工程化', ownerId: 'user-1' }),
    );
    expect(recordRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', skillTreeId: 'tree-1' }),
    );
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/skill-tree
```
Expected: FAIL — `treeRepo.create` 收到的对象没有 `ownerId`。

- [ ] **Step 3: 实体加列**

在 `apps/api/src/modules/skill-tree/entities/skill-tree.entity.ts`：
- import 增加 `Index`、`ManyToOne`、`JoinColumn`、`User`（`../../user/entities/user.entity`）
- 在 `status` 列之后插入：

```ts
  /** 归属用户：技能树为私有资源，仅创建者可读写 */
  @Index()
  @Column({ name: 'owner_id' })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;
```

- [ ] **Step 4: 服务写入 ownerId**

修改 `apps/api/src/modules/skill-tree/skill-tree.service.ts` 的 `create`：

```ts
    const tree = this.treeRepo.create({
      name: data.name,
      description: data.description,
      type: data.type,
      keywords: data.keywords,
      status: 'ACTIVE',
      ownerId: userId,
    });
```

- [ ] **Step 5: 跑测试确认通过**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/skill-tree
```
Expected: PASS

- [ ] **Step 6: 类型检查 + 提交**

```powershell
cd apps/api; node_modules\.bin\tsc --noEmit
git add apps/api/src/modules/skill-tree
git commit -m "✨ feat: 技能树私有归属（skill_trees.owner_id + 创建时写入）"
```

---

## Task 3: `codeExamples` 归一化为 `code_examples` 表

**Files:**
- Create: `apps/api/src/modules/content/entities/code-example.entity.ts`
- Create: `apps/api/src/modules/content/content.service.spec.ts`
- Modify: `apps/api/src/modules/content/entities/node-content.entity.ts`
- Modify: `apps/api/src/modules/content/content.service.ts`
- Modify: `apps/api/src/config/database.config.ts`

**Interfaces:**
- Consumes: `AiIntegrationService.generateL3(...)` 返回 `{ coreText, codeExamples, exercises }`
- Produces: `NodeContent.codeExamples: CodeExample[]`（关系）；对外 HTTP 响应形状**不变**，仍为 `{ title, language, code }[]`

- [ ] **Step 1: 写失败测试**

创建 `apps/api/src/modules/content/content.service.spec.ts`：

```ts
import { ContentService } from './content.service';
import { NodeLevel } from '@skill/shared';

describe('ContentService.generateContent（codeExamples 落子表）', () => {
  let service: ContentService;
  let contentRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let exerciseRepo: { create: jest.Mock; save: jest.Mock };
  let codeExampleRepo: { create: jest.Mock; save: jest.Mock };
  let nodeRepo: { findOne: jest.Mock };
  let treeRepo: { findOne: jest.Mock };
  let aiService: { generateL3: jest.Mock };

  beforeEach(() => {
    contentRepo = {
      findOne: jest.fn(async () => null),
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ ...v, id: 'content-1' })),
    };
    exerciseRepo = { create: jest.fn((v) => v), save: jest.fn(async (v) => v) };
    codeExampleRepo = { create: jest.fn((v) => v), save: jest.fn(async (v) => v) };
    nodeRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'node-1',
          treeId: 'tree-1',
          parentId: 'l1-1',
          level: NodeLevel.L2,
          title: 'L2 主题',
        })
        .mockResolvedValueOnce({ id: 'l1-1', title: 'L1 领域' }),
    };
    treeRepo = { findOne: jest.fn(async () => ({ id: 'tree-1', name: '前端工程化' })) };
    aiService = {
      generateL3: jest.fn(async () => ({
        coreText: '正文',
        codeExamples: [{ title: '示例', language: 'ts', code: 'const a = 1;' }],
        exercises: [
          { question: 'Q', options: ['a', 'b'], correctIndex: 0, explanation: 'E' },
        ],
      })),
    };
    service = new ContentService(
      contentRepo as never,
      exerciseRepo as never,
      codeExampleRepo as never,
      nodeRepo as never,
      treeRepo as never,
      aiService as never,
    );
  });

  it('把 codeExamples 与 exercises 分别写入子表', async () => {
    await service.generateContent('node-1');

    expect(codeExampleRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeContentId: 'content-1',
        title: '示例',
        language: 'ts',
        code: 'const a = 1;',
        sortOrder: 0,
      }),
    );
    expect(exerciseRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ nodeContentId: 'content-1', question: 'Q', sortOrder: 0 }),
    );
    // 内容行不再包含 codeExamples 字段
    expect(contentRepo.create).toHaveBeenCalledWith({
      nodeId: 'node-1',
      coreText: '正文',
      version: 1,
    });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/content
```
Expected: FAIL — 构造参数个数不匹配 / `codeExampleRepo` 未被调用。

- [ ] **Step 3: 新建子表实体**

创建 `apps/api/src/modules/content/entities/code-example.entity.ts`：

```ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { NodeContent } from './node-content.entity';

/** L3 代码示例：与 exercises 对称归一化，取代原 node_contents.code_examples json 列 */
@Entity('code_examples')
export class CodeExample {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'node_content_id' })
  nodeContentId: string;

  @Column()
  title: string;

  @Column()
  language: string;

  @Column({ type: 'text' })
  code: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => NodeContent, (content) => content.codeExamples, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'node_content_id' })
  content: NodeContent;
}
```

- [ ] **Step 4: 改 `NodeContent` 实体**

`apps/api/src/modules/content/entities/node-content.entity.ts`：
- 删除 `codeExamples` 的 `@Column({ name: 'code_examples', type: 'json', ... })` 整段
- 删除对 `CodeExample`（shared）的 import
- `nodeId` 列保持 `unique: true`（唯一约束自带索引，不再额外加 `@Index()`），关系段改为带级联：

```ts
  @Column({ name: 'node_id', unique: true })
  nodeId: string;
```

并把原有关系段替换为：

```ts
  @OneToOne(() => TreeNode, (node) => node.content, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'node_id' })
  node: TreeNode;

  @OneToMany(() => CodeExample, (example) => example.content)
  codeExamples: CodeExample[];
```
（`CodeExample` 从 `./code-example.entity` 引入；`shared` 的 `CodeExample` 值对象类型保留不动，对外响应形状不变）

- [ ] **Step 5: 改 `ContentService`**

`apps/api/src/modules/content/content.service.ts`：
- 构造函数注入 `@InjectRepository(CodeExample) private codeExampleRepo: Repository<CodeExample>`（放在 `exerciseRepo` 之后）
- `getContentByNodeId` 的关系改为：

```ts
    return this.contentRepo.findOne({
      where: { nodeId },
      relations: ['exercises', 'codeExamples'],
      order: { exercises: { sortOrder: 'ASC' }, codeExamples: { sortOrder: 'ASC' } },
    });
```

- `generateContent` 的写入段替换为：

```ts
      const content = this.contentRepo.create({
        nodeId,
        coreText: result.coreText,
        version: 1,
      });
      const saved = await this.contentRepo.save(content);

      const codeExamples = (result.codeExamples || []).map((item, index) =>
        this.codeExampleRepo.create({
          nodeContentId: saved.id,
          title: item.title,
          language: item.language,
          code: item.code,
          sortOrder: index,
        }),
      );
      if (codeExamples.length > 0) {
        await this.codeExampleRepo.save(codeExamples);
      }

      const exercises = (result.exercises || []).map((ex, index) =>
        this.exerciseRepo.create({
          nodeContentId: saved.id,
          question: ex.question,
          options: ex.options,
          correctIndex: ex.correctIndex,
          explanation: ex.explanation,
          sortOrder: index,
        }),
      );
      if (exercises.length > 0) {
        await this.exerciseRepo.save(exercises);
      }
```
（注意：此处顺手把 `result.exercises.map` 的无守卫改为 `(result.exercises || [])`，消除 F3/F7 的 `TypeError`；事务化在阶段 3 处理）

- [ ] **Step 6: 注册实体**

`apps/api/src/config/database.config.ts`：import `CodeExample` 并加入 `entities` 数组。

- [ ] **Step 7: 跑测试确认通过 + 类型检查**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/content
node_modules\.bin\tsc --noEmit
```
Expected: PASS；`tsc` 无错误（注意 `content.controller.ts` 的响应映射已用 `content.codeExamples || []`，无需改动）

- [ ] **Step 8: 提交**

```powershell
git add apps/api/src/modules/content apps/api/src/config/database.config.ts
git commit -m "♻️ refactor: codeExamples 归一化为 code_examples 表（与 exercises 对称）"
```

---

## Task 4: 类型修正 + 唯一约束 + 级联 + 索引

> 本任务只改实体注解，**验证由 Task 12/13 承担**（初始迁移 + schema 断言脚本）。此处要求 `tsc --noEmit` 通过。

**Files:**
- Modify: `apps/api/src/modules/skill-tree/entities/tree-node.entity.ts`
- Modify: `apps/api/src/modules/learning-record/entities/learning-record.entity.ts`
- Modify: `apps/api/src/modules/learning-record/entities/node-learning-record.entity.ts`
- Modify: `apps/api/src/modules/recommendation/entities/recommendation.entity.ts`
- Modify: `apps/api/src/modules/analysis/entities/suggested-change.entity.ts`
- Modify: `apps/api/src/modules/portrait/entities/portrait-answer.entity.ts`
- Modify: `apps/api/src/modules/user/entities/user-profile.entity.ts`

**Interfaces:**
- Produces: 7 处 `varchar` → `uuid`；`learning_records`/`node_learning_records` 唯一约束；`tree_nodes`/`node_contents` 级联；各表索引

- [ ] **Step 1: `tree_nodes` 级联与索引**

`tree-node.entity.ts`：import 增加 `Index`；`tree` 关系加 `onDelete: 'CASCADE'`，`parent` 关系加 `onDelete: 'CASCADE'`；在类上补索引：

```ts
@Index(['treeId', 'level'])
@Index(['parentId'])
@Entity('tree_nodes')
export class TreeNode {
```

- [ ] **Step 2: `learning_records` 类型 + FK + 唯一约束**

`learning-record.entity.ts` 整体替换为：

```ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { LearningStatus } from '@skill/shared';
import { User } from '../../user/entities/user.entity';
import { SkillTree } from '../../skill-tree/entities/skill-tree.entity';

@Entity('learning_records')
@Unique(['userId', 'skillTreeId'])
export class LearningRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index()
  @Column({ name: 'skill_tree_id', type: 'uuid' })
  skillTreeId: string;

  @Column({ type: 'enum', enum: LearningStatus, default: LearningStatus.IN_PROGRESS })
  status: LearningStatus;

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => SkillTree, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_tree_id' })
  skillTree: SkillTree;
}
```

- [ ] **Step 3: `node_learning_records` 类型 + FK + 唯一约束**

`node-learning-record.entity.ts`：

```ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { NodeLearningStatus } from '@skill/shared';
import { User } from '../../user/entities/user.entity';
import { SkillTree } from '../../skill-tree/entities/skill-tree.entity';
import { TreeNode } from '../../skill-tree/entities/tree-node.entity';

@Entity('node_learning_records')
@Unique(['userId', 'nodeId'])
@Index(['userId', 'skillTreeId'])
export class NodeLearningRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'skill_tree_id', type: 'uuid' })
  skillTreeId: string;

  @Index()
  @Column({ name: 'node_id', type: 'uuid' })
  nodeId: string;

  @Column({ type: 'enum', enum: NodeLearningStatus, default: NodeLearningStatus.NOT_STARTED })
  status: NodeLearningStatus;

  @Column({ name: 'started_at', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => SkillTree, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_tree_id' })
  skillTree: SkillTree;

  @ManyToOne(() => TreeNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'node_id' })
  node: TreeNode;
}
```

- [ ] **Step 4: `recommendations` 归属类型 + FK**

`recommendation.entity.ts`：
- `user_id` 改为 `@Column({ name: 'user_id', type: 'uuid' })`
- 新增 User 关系：

```ts
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
```
- `skillTree` 关系的 `@ManyToOne` 增加 `onDelete: 'SET NULL'`
- 类上补 `@Index(['userId', 'isActive'])`

- [ ] **Step 5: `suggested_changes` 节点列类型 + FK**

`suggested-change.entity.ts`：
- 两列改为 `type: 'uuid'`
- 新增两个关系（不建实体反向关系，直接 `@ManyToOne(() => TreeNode, { onDelete: 'SET NULL', nullable: true })`）
- 补 `@Index(['jobId'])`、`@Index(['status'])`

- [ ] **Step 6: `portrait_answers` 级联 + `user_profiles` 版本列**

- `portrait-answer.entity.ts`：`question` 关系加 `onDelete: 'CASCADE'`
- `user-profile.entity.ts`：新增

```ts
  /** computedPortrait 的 zod 契约版本（阶段 3 起写入） */
  @Column({ name: 'portrait_schema_version', nullable: true })
  portraitSchemaVersion?: string;
```

- [ ] **Step 7: 类型检查 + 提交**

```powershell
cd apps/api; node_modules\.bin\tsc --noEmit
git add apps/api/src/modules
git commit -m "🐛 fix: 修正 7 处 varchar/uuid 类型错配，补唯一约束、级联与索引"
```

---

## Task 5: 新表 `ai_generations` 与 `generation_tasks`

**Files:**
- Create: `apps/api/src/modules/ai-integration/entities/ai-generation.entity.ts`
- Create: `apps/api/src/modules/content/entities/generation-task.entity.ts`
- Modify: `apps/api/src/config/database.config.ts`
- Modify: `packages/shared/src/enums/index.ts`

**Interfaces:**
- Produces: `ArtifactKind` / `GenerationTaskStatus` 枚举；两张实体（阶段 3/4 才写入）

- [ ] **Step 1: 加枚举到 shared**

`packages/shared/src/enums/index.ts` 末尾追加：

```ts
/** AI 产物种类（一个种类 = 一个契约 + 一个状态） */
export enum ArtifactKind {
  L3_CORE_TEXT = 'L3_CORE_TEXT',
  L3_CODE_EXAMPLES = 'L3_CODE_EXAMPLES',
  L3_EXERCISES = 'L3_EXERCISES',
}

export enum GenerationTaskStatus {
  PENDING = 'PENDING',
  GENERATING = 'GENERATING',
  READY = 'READY',
  FAILED = 'FAILED',
}

export enum AiGenerationErrorKind {
  INVALID_JSON = 'invalid_json',
  TRUNCATED = 'truncated',
  SCHEMA_MISMATCH = 'schema_mismatch',
  PROVIDER_ERROR = 'provider_error',
}
```

- [ ] **Step 2: 重新构建 shared**

```powershell
$env:PNPM_HOME = Join-Path (Get-Location) ".pnpm-home"
pnpm --filter shared build
```
Expected: `packages/shared/dist` 更新（`dist/types/enums/index.d.ts` 含 `ArtifactKind`）

- [ ] **Step 3: 创建 `ai_generations` 实体**

创建 `apps/api/src/modules/ai-integration/entities/ai-generation.entity.ts`：

```ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AiGenerationErrorKind } from '@skill/shared';
import { User } from '../../user/entities/user.entity';
import { SkillTree } from '../../skill-tree/entities/skill-tree.entity';
import { TreeNode } from '../../skill-tree/entities/tree-node.entity';

/** 一次真实 AI 调用的审计记录（重试各占一行） */
@Entity('ai_generations')
@Index(['treeId', 'createdAt'])
@Index(['stage', 'createdAt'])
export class AiGeneration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  stage: string;

  @Column({ name: 'prompt_version' })
  promptVersion: string;

  @Column()
  provider: string;

  @Column()
  model: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ name: 'tree_id', type: 'uuid', nullable: true })
  treeId?: string | null;

  @Column({ name: 'node_id', type: 'uuid', nullable: true })
  nodeId?: string | null;

  @Column({ name: 'request_hash' })
  requestHash: string;

  /** 原始响应可能不是合法 JSON，故用 text 而非 jsonb */
  @Column({ name: 'raw_response', type: 'text' })
  rawResponse: string;

  @Column({ name: 'parsed_ok', default: false })
  parsedOk: boolean;

  @Column({ name: 'error_kind', type: 'enum', enum: AiGenerationErrorKind, nullable: true })
  errorKind?: AiGenerationErrorKind | null;

  @Column({ name: 'error_detail', type: 'text', nullable: true })
  errorDetail?: string | null;

  @Column({ name: 'prompt_tokens', nullable: true })
  promptTokens?: number | null;

  @Column({ name: 'completion_tokens', nullable: true })
  completionTokens?: number | null;

  @Column({ name: 'latency_ms' })
  latencyMs: number;

  @Column({ default: 1 })
  attempt: number;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @ManyToOne(() => SkillTree, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tree_id' })
  tree?: SkillTree | null;

  @ManyToOne(() => TreeNode, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'node_id' })
  node?: TreeNode | null;
}
```

- [ ] **Step 4: 创建 `generation_tasks` 实体**

创建 `apps/api/src/modules/content/entities/generation-task.entity.ts`：

```ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { ArtifactKind, GenerationTaskStatus } from '@skill/shared';
import { TreeNode } from '../../skill-tree/entities/tree-node.entity';

/** 某节点上某类产物的生成意图与状态（幂等键：node_id + artifact_kind） */
@Entity('generation_tasks')
@Unique(['nodeId', 'artifactKind'])
export class GenerationTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'node_id', type: 'uuid' })
  nodeId: string;

  @Column({ name: 'artifact_kind', type: 'enum', enum: ArtifactKind })
  artifactKind: ArtifactKind;

  @Index()
  @Column({ type: 'enum', enum: GenerationTaskStatus, default: GenerationTaskStatus.PENDING })
  status: GenerationTaskStatus;

  @Column({ default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null;

  @Column({ name: 'prompt_version', nullable: true })
  promptVersion?: string | null;

  @Column({ nullable: true })
  model?: string | null;

  @Column({ name: 'started_at', nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'finished_at', nullable: true })
  finishedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => TreeNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'node_id' })
  node: TreeNode;
}
```

- [ ] **Step 5: 注册两个实体**

`apps/api/src/config/database.config.ts`：import 并加入 `entities` 数组（应在 Task 3 之后，数组顺序：`... CodeExample, AiGeneration, GenerationTask`）。

- [ ] **Step 6: 类型检查 + 提交**

```powershell
cd apps/api; node_modules\.bin\tsc --noEmit
git add packages/shared/src/enums/index.ts apps/api/src/modules apps/api/src/config/database.config.ts
git commit -m "✨ feat: 新增 ai_generations 审计表与 generation_tasks 产物状态表"
```

---

## Task 6: schema 断言脚本（本阶段的验收测试）

**Files:**
- Create: `apps/api/scripts/verify-schema.ts`

**Interfaces:**
- Consumes: `pg` 驱动（已是 `apps/api` 直接依赖）
- Produces: `npm run schema:verify`（或直接 `ts-node scripts/verify-schema.ts`）——通过则打印 `SCHEMA OK`

- [ ] **Step 1: 写脚本**

```ts
/**
 * 目标 schema 断言（阶段 1 验收测试）。
 * 用法：cd apps/api; node_modules\.bin\ts-node scripts/verify-schema.ts
 * 连接参数从根 .env 读取（不引入 dotenv 依赖）。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

function loadEnv(): Record<string, string> {
  const raw = readFileSync(join(__dirname, '../../../.env'), 'utf8');
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

const EXPECTED_TABLES = [
  'ai_generations',
  'analysis_jobs',
  'code_examples',
  'exercises',
  'generation_tasks',
  'interview_questions',
  'learning_records',
  'node_contents',
  'node_learning_records',
  'portrait_answers',
  'portrait_questions',
  'recommendations',
  'skill_trees',
  'suggested_changes',
  'tree_nodes',
  'user_profiles',
  'users',
]; // 17 张

const FORBIDDEN_TABLES = ['global_configs', 'recommendation_jobs'];
const UUID_COLUMNS = [
  ['learning_records', 'user_id'],
  ['learning_records', 'skill_tree_id'],
  ['node_learning_records', 'user_id'],
  ['node_learning_records', 'skill_tree_id'],
  ['node_learning_records', 'node_id'],
  ['recommendations', 'user_id'],
  ['suggested_changes', 'parent_node_id'],
  ['suggested_changes', 'target_node_id'],
] as const;
const CASCADE_FKS = [
  ['tree_nodes', 'tree_id'],
  ['tree_nodes', 'parent_id'],
  ['node_contents', 'node_id'],
  ['code_examples', 'node_content_id'],
  ['exercises', 'node_content_id'],
  ['learning_records', 'skill_tree_id'],
  ['node_learning_records', 'node_id'],
  ['interview_questions', 'l2_node_id'],
] as const;
const UNIQUE_CONSTRAINTS: ReadonlyArray<readonly [string, string[]]> = [
  ['learning_records', ['user_id', 'skill_tree_id']],
  ['node_learning_records', ['user_id', 'node_id']],
  ['generation_tasks', ['node_id', 'artifact_kind']],
  ['node_contents', ['node_id']],
];

async function main() {
  const env = loadEnv();
  const client = new Client({
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USERNAME || 'postgres',
    password: env.DB_PASSWORD || '',
    database: env.DB_DATABASE || 'skill_learning',
  });
  await client.connect();

  const failures: string[] = [];
  const check = (ok: boolean, label: string) => {
    if (!ok) failures.push(label);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  };

  const { rows: tables } = await client.query<{ table_name: string }>(
    `select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`,
  );
  const names = tables.map((t) => t.table_name).sort();
  check(
    JSON.stringify(names) === JSON.stringify([...EXPECTED_TABLES].sort()),
    `表集合 == 17 张目标表（实际 ${names.length}：${names.join(', ')}）`,
  );
  for (const t of FORBIDDEN_TABLES) {
    check(!names.includes(t), `死表已删除：${t}`);
  }

  for (const [table, column] of UUID_COLUMNS) {
    const { rows } = await client.query<{ data_type: string }>(
      `select data_type from information_schema.columns where table_schema='public' and table_name=$1 and column_name=$2`,
      [table, column],
    );
    check(rows[0]?.data_type === 'uuid', `${table}.${column} 为 uuid（实际 ${rows[0]?.data_type}）`);
  }

  for (const [table, column] of CASCADE_FKS) {
    const { rows } = await client.query<{ confdeltype: string }>(
      `select c.confdeltype from pg_constraint c
         join pg_class rel on rel.oid = c.conrelid
         join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
        where c.contype='f' and rel.relname=$1 and a.attname=$2`,
      [table, column],
    );
    check(rows[0]?.confdeltype === 'c', `${table}.${column} 外键 ON DELETE CASCADE`);
  }

  for (const [table, columns] of UNIQUE_CONSTRAINTS) {
    const { rows } = await client.query<{ cols: string }>(
      `select string_agg(a.attname, ',' order by a.attname) cols
         from pg_constraint c
         join pg_class rel on rel.oid = c.conrelid
         join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
        where c.contype='u' and rel.relname=$1
        group by c.conname`,
      [table],
    );
    const wanted = [...columns].sort().join(',');
    check(
      rows.some((r) => r.cols === wanted),
      `${table} 唯一约束 (${wanted})`,
    );
  }

  const { rows: idx } = await client.query<{ n: string }>(
    `select count(*) n from pg_indexes where schemaname='public' and indexdef not like '%UNIQUE%'`,
  );
  check(Number(idx[0].n) >= 20, `非唯一索引数量 >= 20（实际 ${idx[0].n}）`);

  await client.end();

  if (failures.length > 0) {
    console.error(`\n${failures.length} 项断言失败：`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log('\nSCHEMA OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

> 实现提示：脚本中的 `UNIQUE_CONSTRAINTS`、`CASCADE_FKS`、`UUID_COLUMNS` 三张清单就是设计文档 5.2/5.3 的可执行版本；断言失败信息里会带上实际类型/行为，便于定位。

- [ ] **Step 2: 跑脚本确认失败（红）**

```powershell
cd apps/api; node_modules\.bin\ts-node scripts/verify-schema.ts
```
Expected: FAIL 多项 —— 当前库仍是旧 schema（16 张表、含 2 张死表、`code_examples` 表不存在、7 处 varchar、无唯一约束、非唯一索引 0）
**把失败清单记下来，它是 Task 7 的验收依据。**

- [ ] **Step 3: 提交（红态脚本先入库）**

```powershell
git add apps/api/scripts/verify-schema.ts
git commit -m "🧪 test: schema 断言脚本（当前为红态，待初始迁移转绿）"
```

---

## Task 7: 生成初始迁移并重建本地库（阶段 1 收尾）

**Files:**
- Create: `apps/api/src/migrations/<timestamp>-InitialSchema.ts`（由 CLI 生成）
- Modify: `apps/api/src/config/database.config.ts`

**Interfaces:**
- Consumes: Task 1–6 的全部实体变更 + `scripts/verify-schema.ts`
- Produces: 可重复执行的迁移；库为 17 张表的目标 schema

- [ ] **Step 1: 重建空库**

```powershell
$pw = ((Get-Content .env | Where-Object { $_ -match '^DB_PASSWORD=' }) -replace '^DB_PASSWORD=','').Trim()
$env:PGPASSWORD = $pw
$psql = "D:\Environment\PostgreSQL\18\bin\psql.exe"
# 断开其他连接后重建（库内为测试数据，已全量备份）
& $psql -h localhost -p 5432 -U postgres -d postgres -c "drop database if exists skill_learning with (force);"
& $psql -h localhost -p 5432 -U postgres -d postgres -c "create database skill_learning;"
$env:PGPASSWORD = $null
```
Expected: `DROP DATABASE` / `CREATE DATABASE`（孤儿树与编码损坏数据随之消失，见设计文档 5.6）

- [ ] **Step 2: 从实体生成初始迁移**

```powershell
$env:PNPM_HOME = Join-Path (Get-Location) ".pnpm-home"
cd apps/api
node_modules\.bin\typeorm-ts-node-commonjs -d src/config/data-source.ts migration:generate src/migrations/InitialSchema
```
Expected: 生成 `src/migrations/<timestamp>-InitialSchema.ts`，内含 17 张表的 `CREATE TABLE`、PG enum 类型、外键（含 CASCADE/SET NULL）、唯一约束与索引。

- [ ] **Step 3: 人工评审迁移文件（必做，不可跳过）**

逐项核对：
- [ ] `skill_trees` 有 `owner_id` 且 `NOT NULL` + FK `ON DELETE CASCADE`
- [ ] `learning_records` / `node_learning_records` 的 `*_id` 全部是 `uuid`
- [ ] `tree_nodes.parent_id` / `tree_id`、`node_contents.node_id`、`code_examples.node_content_id` 是 `ON DELETE CASCADE`
- [ ] `recommendations.user_id` 为 uuid 且 CASCADE；`skill_tree_id` 为 `SET NULL`
- [ ] `suggested_changes.parent_node_id` / `target_node_id` 为 uuid 且 `SET NULL`
- [ ] 存在 `UNIQUE (user_id, skill_tree_id)`、`UNIQUE (user_id, node_id)`、`UNIQUE (node_id, artifact_kind)`
- [ ] **没有** `global_configs` / `recommendation_jobs`（库已清空，不会生成）
- [ ] **没有** `node_contents.code_examples` 列
- [ ] 非唯一索引数量 >= 20

> ⚠️ 若 `migration:generate` 因 `owner_id NOT NULL` 之类报错，说明实体注解有误，回到 Task 2–5 修正——**不要手改迁移文件绕过**。

- [ ] **Step 4: 应用迁移**

```powershell
cd apps/api
node_modules\.bin\typeorm-ts-node-commonjs -d src/config/data-source.ts migration:run
```
Expected: `InitialSchema` 执行成功

- [ ] **Step 5: 跑 schema 断言脚本（绿）**

```powershell
cd apps/api; node_modules\.bin\ts-node scripts/verify-schema.ts
```
Expected: 全部 `PASS` + `SCHEMA OK`；且输出中**缺少的失败项与 Step 2 记录的清单一一对应**

- [ ] **Step 6: 注册迁移到 database.config**

`apps/api/src/config/database.config.ts`：import 生成的迁移类并填入 `migrations: [InitialSchema]`。

- [ ] **Step 7: 全量测试 + 类型检查 + 阶段 1 收尾提交**

```powershell
cd apps/api
node_modules\.bin\tsc --noEmit
node_modules\.bin\jest --runInBand
```
Expected: `tsc` 无错误；jest 原有 5 个 suite + 本阶段新增 3 个 suite 全绿

```powershell
git add apps/api
git commit -m "✨ feat: 阶段 1 完成 —— 初始迁移与本地库重建（17 张表、类型/约束/级联/索引就位）"
```

---

# 阶段 2：授权收口

## Task 8: 归属校验单一实现

**Files:**
- Create: `apps/api/src/modules/tree-access/tree-access.service.ts`
- Create: `apps/api/src/modules/tree-access/tree-access.module.ts`
- Create: `apps/api/src/modules/tree-access/tree-access.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Produces:
  - `TreeAccessService.assertTreeOwner(treeId: string, userId: string): Promise<SkillTree>`
  - `TreeAccessService.assertNodeOwner(nodeId: string, userId: string): Promise<TreeNode>`
  - 不存在 → `NotFoundException`；存在但非本人 → `ForbiddenException`

- [ ] **Step 1: 写失败测试**

创建 `apps/api/src/modules/tree-access/tree-access.service.spec.ts`：

```ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TreeAccessService } from './tree-access.service';

describe('TreeAccessService', () => {
  let service: TreeAccessService;
  let treeRepo: { findOne: jest.Mock };
  let nodeRepo: { findOne: jest.Mock };

  beforeEach(() => {
    treeRepo = { findOne: jest.fn() };
    nodeRepo = { findOne: jest.fn() };
    service = new TreeAccessService(treeRepo as never, nodeRepo as never);
  });

  it('本人可访问自己的树', async () => {
    treeRepo.findOne.mockResolvedValue({ id: 't1', ownerId: 'u1' });
    await expect(service.assertTreeOwner('t1', 'u1')).resolves.toMatchObject({ id: 't1' });
  });

  it('他人访问 → 403', async () => {
    treeRepo.findOne.mockResolvedValue({ id: 't1', ownerId: 'u1' });
    await expect(service.assertTreeOwner('t1', 'u2')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('树不存在 → 404', async () => {
    treeRepo.findOne.mockResolvedValue(null);
    await expect(service.assertTreeOwner('t1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('节点归属按其所属树判定', async () => {
    nodeRepo.findOne.mockResolvedValue({ id: 'n1', treeId: 't1' });
    treeRepo.findOne.mockResolvedValue({ id: 't1', ownerId: 'u1' });
    await expect(service.assertNodeOwner('n1', 'u1')).resolves.toMatchObject({ id: 'n1' });
    await expect(service.assertNodeOwner('n1', 'u2')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('节点不存在 → 404', async () => {
    nodeRepo.findOne.mockResolvedValue(null);
    await expect(service.assertNodeOwner('n1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/tree-access
```
Expected: FAIL — 模块不存在。

- [ ] **Step 3: 实现**

创建 `apps/api/src/modules/tree-access/tree-access.service.ts`：

```ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkillTree } from '../skill-tree/entities/skill-tree.entity';
import { TreeNode } from '../skill-tree/entities/tree-node.entity';

/**
 * 技能树为私有资源：仅创建者可读写。
 * 所有按 id 访问树/节点的服务都通过本服务校验归属，避免规则散落各处。
 * 后续若升级为 Guard，只需替换这一个实现。
 */
@Injectable()
export class TreeAccessService {
  constructor(
    @InjectRepository(SkillTree)
    private readonly treeRepo: Repository<SkillTree>,
    @InjectRepository(TreeNode)
    private readonly nodeRepo: Repository<TreeNode>,
  ) {}

  async assertTreeOwner(treeId: string, userId: string): Promise<SkillTree> {
    const tree = await this.treeRepo.findOne({ where: { id: treeId } });
    if (!tree) {
      throw new NotFoundException('Skill tree not found');
    }
    if (tree.ownerId !== userId) {
      throw new ForbiddenException('无权访问该技能树');
    }
    return tree;
  }

  async assertNodeOwner(nodeId: string, userId: string): Promise<TreeNode> {
    const node = await this.nodeRepo.findOne({ where: { id: nodeId } });
    if (!node) {
      throw new NotFoundException('Node not found');
    }
    await this.assertTreeOwner(node.treeId, userId);
    return node;
  }
}
```

创建 `apps/api/src/modules/tree-access/tree-access.module.ts`：

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillTree } from '../skill-tree/entities/skill-tree.entity';
import { TreeNode } from '../skill-tree/entities/tree-node.entity';
import { TreeAccessService } from './tree-access.service';

@Module({
  imports: [TypeOrmModule.forFeature([SkillTree, TreeNode])],
  providers: [TreeAccessService],
  exports: [TreeAccessService],
})
export class TreeAccessModule {}
```

- [ ] **Step 4: 跑测试确认通过**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/tree-access
```
Expected: PASS（5 个用例）

- [ ] **Step 5: 注册模块**

`apps/api/src/app.module.ts`：import `TreeAccessModule` 并加入 `imports` 数组（放在 `SkillTreeModule` 之前）。

- [ ] **Step 6: 提交**

```powershell
cd apps/api; node_modules\.bin\tsc --noEmit
git add apps/api/src/modules/tree-access apps/api/src/app.module.ts
git commit -m "✨ feat: 归属校验单一实现 TreeAccessService（404/403 语义）"
```

---

## Task 9: 授权铺开 —— tree-node

**Files:**
- Create: `apps/api/src/modules/tree-node/tree-node.service.spec.ts`
- Modify: `apps/api/src/modules/tree-node/tree-node.service.ts`
- Modify: `apps/api/src/modules/tree-node/tree-node.controller.ts`
- Modify: `apps/api/src/modules/tree-node/tree-node.module.ts`
- Create: `apps/api/src/modules/tree-node/dto/update-node.dto.ts`

**Interfaces:**
- Consumes: `TreeAccessService.assertNodeOwner(nodeId, userId)`
- Produces: `TreeNodeService` 五个方法全部要求 `userId`；`UpdateNodeDto` 只允许 `title` / `description`

- [ ] **Step 1: 写失败测试**

创建 `apps/api/src/modules/tree-node/tree-node.service.spec.ts`：

```ts
import { TreeNodeService } from './tree-node.service';
import { NodeLevel } from '@skill/shared';

describe('TreeNodeService（归属校验）', () => {
  let service: TreeNodeService;
  let nodeRepo: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock; delete: jest.Mock };
  let treeRepo: { findOne: jest.Mock };
  let aiService: { generateL2: jest.Mock };
  let treeAccess: { assertNodeOwner: jest.Mock; assertTreeOwner: jest.Mock };

  beforeEach(() => {
    nodeRepo = {
      findOne: jest.fn(),
      find: jest.fn(async () => []),
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => v),
      update: jest.fn(),
      delete: jest.fn(),
    };
    treeRepo = { findOne: jest.fn(async () => ({ id: 't1', name: 'T' })) };
    aiService = { generateL2: jest.fn(async () => ({ nodes: [] })) };
    treeAccess = { assertNodeOwner: jest.fn(), assertTreeOwner: jest.fn() };
    service = new TreeNodeService(
      nodeRepo as never,
      treeRepo as never,
      aiService as never,
      treeAccess as never,
    );
  });

  it('expand 前先校验归属', async () => {
    treeAccess.assertNodeOwner.mockResolvedValue({
      id: 'n1',
      treeId: 't1',
      level: NodeLevel.L1,
      title: 'L1',
      description: 'd',
    });

    await service.expand('n1', 'u1');

    expect(treeAccess.assertNodeOwner).toHaveBeenCalledWith('n1', 'u1');
  });

  it('remove 前先校验归属', async () => {
    treeAccess.assertNodeOwner.mockResolvedValue({ id: 'n1', treeId: 't1' });

    await service.remove('n1', 'u1');

    expect(treeAccess.assertNodeOwner).toHaveBeenCalledWith('n1', 'u1');
    expect(nodeRepo.delete).toHaveBeenCalledWith('n1');
  });

  it('update 只把白名单字段交给 repo', async () => {
    treeAccess.assertNodeOwner.mockResolvedValue({ id: 'n1', treeId: 't1' });
    nodeRepo.findOne.mockResolvedValue({ id: 'n1', title: 'new' });

    await service.update('n1', { title: 'new' }, 'u1');

    expect(nodeRepo.update).toHaveBeenCalledWith('n1', { title: 'new' });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/tree-node
```
Expected: FAIL — 构造函数少一个参数、方法签名不符。

- [ ] **Step 3: 服务加归属校验**

`apps/api/src/modules/tree-node/tree-node.service.ts`：构造函数末尾注入 `private readonly treeAccess: TreeAccessService`；五个方法改为：

```ts
  async findById(id: string, userId: string): Promise<TreeNode> {
    return this.treeAccess.assertNodeOwner(id, userId);
  }

  async findChildren(parentId: string, userId: string): Promise<TreeNode[]> {
    await this.treeAccess.assertNodeOwner(parentId, userId);
    return this.nodeRepo.find({ where: { parentId }, order: { sortOrder: 'ASC' } });
  }

  async expand(id: string, userId: string): Promise<TreeNode[]> {
    const node = await this.treeAccess.assertNodeOwner(id, userId);
    // ...其余逻辑不变（L3 拒绝、已有子节点直接返回、L1 生成 L2）
  }

  async update(id: string, data: Pick<TreeNode, 'title' | 'description'>, userId: string): Promise<TreeNode> {
    await this.treeAccess.assertNodeOwner(id, userId);
    await this.nodeRepo.update(id, data);
    return this.findById(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.treeAccess.assertNodeOwner(id, userId);
    await this.nodeRepo.delete(id);
  }
```

- [ ] **Step 4: 控制器传 userId + DTO**

创建 `apps/api/src/modules/tree-node/dto/update-node.dto.ts`：

```ts
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateNodeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
```

`tree-node.controller.ts`：每个方法加 `@Request() req: { user: { userId: string } }` 并透传；`@Patch(':id')` 的 `@Body() dto: Partial<{...}>` 换成 `@Body() dto: UpdateNodeDto`。

- [ ] **Step 5: 模块导入 TreeAccessModule**

`tree-node.module.ts`：`imports` 加入 `TreeAccessModule`。

- [ ] **Step 6: 跑测试 + 类型检查**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/tree-node; node_modules\.bin\tsc --noEmit
```
Expected: PASS；`tsc` 无错误

- [ ] **Step 7: 提交**

```powershell
git add apps/api/src/modules/tree-node
git commit -m "✨ feat: tree-node 全部端点补归属校验与 UpdateNodeDto"
```

---

## Task 10: 授权铺开 —— content

**Files:**
- Modify: `apps/api/src/modules/content/content.service.ts`
- Modify: `apps/api/src/modules/content/content.controller.ts`
- Modify: `apps/api/src/modules/content/content.module.ts`
- Create: `apps/api/src/modules/content/dto/update-node-content.dto.ts`
- Modify: `apps/api/src/modules/content/content.service.spec.ts`

**Interfaces:**
- Consumes: `TreeAccessService.assertNodeOwner`
- Produces: `ContentService.generateContent(nodeId, userId)` / `getContentByNodeId(nodeId, userId)` / `updateContent(nodeId, data, userId)`

- [ ] **Step 1: 扩测试**

在 `content.service.spec.ts` 的 `beforeEach` 中给构造函数追加 `treeAccess`（mock `{ assertNodeOwner: jest.fn() }`），并新增用例：

```ts
  it('生成前先校验归属', async () => {
    await service.generateContent('node-1', 'u1');
    expect(treeAccess.assertNodeOwner).toHaveBeenCalledWith('node-1', 'u1');
  });

  it('读取前先校验归属', async () => {
    contentRepo.findOne.mockResolvedValue({ id: 'c1', nodeId: 'node-1', exercises: [], codeExamples: [] });
    await service.getContentByNodeId('node-1', 'u1');
    expect(treeAccess.assertNodeOwner).toHaveBeenCalledWith('node-1', 'u1');
  });
```

- [ ] **Step 2: 跑测试确认失败**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/content
```
Expected: FAIL — 方法签名与构造参数不符。

- [ ] **Step 3: 服务加 userId 与校验**

`content.service.ts`：
- 注入 `private readonly treeAccess: TreeAccessService`
- 三个方法签名与首行改为：

```ts
  async getContentByNodeId(nodeId: string, userId: string): Promise<NodeContent | null> {
    await this.treeAccess.assertNodeOwner(nodeId, userId);
    return this.contentRepo.findOne({ /* 同 Task 3 Step 5 */ });
  }

  async generateContent(nodeId: string, userId: string): Promise<NodeContent> {
    await this.treeAccess.assertNodeOwner(nodeId, userId);
    // ...其余逻辑不变（内部对 getContentByNodeId 的调用改为传 userId）
  }

  async updateContent(nodeId: string, data: Pick<NodeContent, 'coreText'>, userId: string): Promise<NodeContent> {
    await this.treeAccess.assertNodeOwner(nodeId, userId);
    await this.contentRepo.update({ nodeId }, data);
    const content = await this.getContentByNodeId(nodeId, userId);
    if (!content) {
      throw new NotFoundException('Content not found');
    }
    return content;
  }
```

> 注意：`generateContent` 内部若仍调用 `this.getContentByNodeId(nodeId, userId)` 会二次校验，可接受（同一事务外的一次额外查询）；如需避免，抽一个私有 `loadContent(nodeId)` 供内部使用。

- [ ] **Step 4: 控制器 + DTO**

创建 `apps/api/src/modules/content/dto/update-node-content.dto.ts`：

```ts
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateNodeContentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  coreText?: string;
}
```

`content.controller.ts`：三个方法加 `@Request() req`，透传 `req.user.userId`；`@Patch()` 的 body 换 `UpdateNodeContentDto`。

- [ ] **Step 5: 模块导入 + 测试**

`content.module.ts`：`imports` 加 `TreeAccessModule`。

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/content; node_modules\.bin\tsc --noEmit
```
Expected: PASS

- [ ] **Step 6: 提交**

```powershell
git add apps/api/src/modules/content
git commit -m "✨ feat: content 端点补归属校验与 UpdateNodeContentDto（堵 mass assignment）"
```

---

## Task 11: 授权铺开 —— interview 与 analysis

**Files:**
- Modify: `apps/api/src/modules/interview/interview.service.ts`
- Modify: `apps/api/src/modules/interview/interview.controller.ts`
- Modify: `apps/api/src/modules/interview/interview.module.ts`
- Modify: `apps/api/src/modules/interview/interview.service.spec.ts`
- Modify: `apps/api/src/modules/analysis/analysis.service.ts`
- Modify: `apps/api/src/modules/analysis/analysis.controller.ts`
- Modify: `apps/api/src/modules/analysis/analysis.module.ts`
- Modify: `apps/api/src/modules/analysis/analysis.service.spec.ts`

**Interfaces:**
- Consumes: `TreeAccessService.assertTreeOwner`
- Produces: `InterviewService.findForTree(treeId, userId)`；`AnalysisService.analyze(treeId, userId)` / `findPendingSuggestions(treeId, userId)` / `applySuggestion(id, userId)` / `ignoreSuggestion(id, userId)`

- [ ] **Step 1: 扩测试（interview）**

`interview.service.spec.ts`：构造函数追加 `treeAccess` mock，并新增：

```ts
  it('读取面试题前先校验树归属', async () => {
    questionRepo.find.mockResolvedValue([]);
    await service.findForTree('t-1', 'u1');
    expect(treeAccess.assertTreeOwner).toHaveBeenCalledWith('t-1', 'u1');
  });
```
（需把现有 `service.findForTree('t-1')` 调用全部补上第二参数 `'u1'`）

- [ ] **Step 2: 扩测试（analysis）**

`analysis.service.spec.ts`：构造函数追加 `treeAccess` mock，并新增：

```ts
  it('分析前先校验树归属', async () => {
    suggestionRepo.find.mockResolvedValue([]);
    await service.analyze('t-1', 'u1');
    expect(treeAccess.assertTreeOwner).toHaveBeenCalledWith('t-1', 'u1');
  });

  it('采纳建议时按建议所属树的 owner 校验', async () => {
    suggestionRepo.findOne.mockResolvedValue({
      id: 's1', status: SuggestionStatus.PENDING, action: SuggestionAction.ADD,
      title: 'x', job: { treeId: 't-1' },
    });
    await service.applySuggestion('s1', 'u1');
    expect(treeAccess.assertTreeOwner).toHaveBeenCalledWith('t-1', 'u1');
  });
```

- [ ] **Step 3: 跑测试确认失败**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/interview src/modules/analysis
```
Expected: FAIL

- [ ] **Step 4: 实现**

- `interview.service.ts`：注入 `TreeAccessService`；`findForTree(treeId, userId)` 首行 `await this.treeAccess.assertTreeOwner(treeId, userId);`
- `analysis.service.ts`：注入 `TreeAccessService`；
  - `analyze(treeId, userId)`、`findPendingSuggestions(treeId, userId)` 首行校验
  - `applySuggestion(id, userId)` / `ignoreSuggestion(id, userId)`：先按 id 取出建议（含 `job.treeId`），再 `assertTreeOwner(job.treeId, userId)`，**校验在状态检查之前**
- 两个 controller 加 `@Request() req` 透传 userId
- 两个 module 的 `imports` 加 `TreeAccessModule`

- [ ] **Step 5: 跑测试 + 类型检查**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/interview src/modules/analysis; node_modules\.bin\tsc --noEmit
```
Expected: PASS

- [ ] **Step 6: 提交**

```powershell
git add apps/api/src/modules/interview apps/api/src/modules/analysis
git commit -m "✨ feat: interview 与 analysis 端点补归属校验"
```

---

## Task 12: 授权铺开 —— skill-tree（含级联简化）

**Files:**
- Modify: `apps/api/src/modules/skill-tree/skill-tree.service.ts`
- Modify: `apps/api/src/modules/skill-tree/skill-tree.controller.ts`
- Modify: `apps/api/src/modules/skill-tree/skill-tree.module.ts`
- Modify: `apps/api/src/modules/skill-tree/skill-tree.service.spec.ts`

**Interfaces:**
- Consumes: `TreeAccessService.assertTreeOwner`
- Produces: `SkillTreeService.findById(id, userId)` / `update(id, data, userId)` / `remove(id, userId)`；`remove` 依赖数据库级联，不再手工删子行

- [ ] **Step 1: 扩测试**

在 `skill-tree.service.spec.ts` 追加：

```ts
  it('findById 校验归属后返回', async () => {
    await service.findById('tree-1', 'user-1');
    expect(treeAccess.assertTreeOwner).toHaveBeenCalledWith('tree-1', 'user-1');
  });

  it('remove 只删树本身（子行交给数据库级联）', async () => {
    await service.remove('tree-1', 'user-1');

    expect(treeAccess.assertTreeOwner).toHaveBeenCalledWith('tree-1', 'user-1');
    expect(treeRepo.delete).toHaveBeenCalledWith('tree-1');
    expect(nodeRepo.delete).not.toHaveBeenCalled();
    expect(recordRepo.delete).not.toHaveBeenCalled();
  });
```
（`treeRepo`/`recordRepo` mock 需补 `delete: jest.fn()`；构造函数追加 `treeAccess`）

- [ ] **Step 2: 跑测试确认失败**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/skill-tree
```
Expected: FAIL

- [ ] **Step 3: 实现**

`skill-tree.service.ts`：
- 注入 `TreeAccessService`
- `findById(id, userId)`：`await this.treeAccess.assertTreeOwner(id, userId)` 后按原逻辑查（含 `relations: ['nodes']`）
- `update(id, data, userId)`：先 `assertTreeOwner`，再 `treeRepo.update`
- `remove(id, userId)` 整体替换为：

```ts
  async remove(id: string, userId: string): Promise<void> {
    await this.treeAccess.assertTreeOwner(id, userId);
    // 节点、内容、练习、学习记录、面试题、分析任务均由外键 ON DELETE CASCADE 清理；
    // 推荐指向本树的 skill_tree_id 由 ON DELETE SET NULL 置空（见设计文档 5.2）
    await this.treeRepo.delete(id);
  }
```
- `create` 内部对 `this.findById(saved.id)` 的调用改为 `this.findById(saved.id, userId)`

- [ ] **Step 4: 控制器传 userId**

`skill-tree.controller.ts`：`@Get(':id')`、`@Patch(':id')`、`@Delete(':id')` 加 `@Request() req` 并透传；`@Patch` 的 body 类型保持 `Partial<CreateSkillTreeDto>`（已是 DTO，无需新增）。

- [ ] **Step 5: 模块 + 测试 + 类型检查**

`skill-tree.module.ts`：`imports` 加 `TreeAccessModule`。

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/skill-tree; node_modules\.bin\tsc --noEmit
```
Expected: PASS

- [ ] **Step 6: 提交**

```powershell
git add apps/api/src/modules/skill-tree
git commit -m "✨ feat: skill-tree 端点补归属校验，删树改用数据库级联"
```

---

## Task 13: DTO 收口（剩余裸类型 body）

**Files:**
- Create: `apps/api/src/modules/learning-record/dto/create-learning-record.dto.ts`
- Create: `apps/api/src/modules/learning-record/dto/update-node-learning-status.dto.ts`
- Create: `apps/api/src/modules/recommendation/dto/from-recommendation.dto.ts`
- Create: `apps/api/src/modules/learning-record/dto/dto.spec.ts`
- Modify: `apps/api/src/modules/learning-record/learning-record.controller.ts`
- Modify: `apps/api/src/modules/learning-record/node-learning-record.controller.ts`
- Modify: `apps/api/src/modules/recommendation/recommendation.controller.ts`
- Modify: `apps/api/src/modules/learning-record/learning-record.service.ts`
- Modify: `apps/api/src/modules/learning-record/learning-record.module.ts`
- Modify: `apps/api/src/modules/recommendation/recommendation.module.ts`

**Interfaces:**
- Produces:
  - `CreateLearningRecordDto { skillTreeId: string }`
  - `UpdateNodeLearningStatusDto { status: NodeLearningStatus }`
  - `FromRecommendationDto { recommendationId: string; type?: TreeType; selectedPoints?: string[] }`
  - `LearningRecordService.create(userId, skillTreeId)` 增加**树归属校验**（私有树不允许他人挂学习记录）

- [ ] **Step 1: 写失败测试**

创建 `apps/api/src/modules/learning-record/dto/dto.spec.ts`：

```ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { NodeLearningStatus, TreeType } from '@skill/shared';
import { CreateLearningRecordDto } from './create-learning-record.dto';
import { UpdateNodeLearningStatusDto } from './update-node-learning-status.dto';
import { FromRecommendationDto } from '../../recommendation/dto/from-recommendation.dto';

async function validateWhitelisted<T extends object>(cls: new () => T, payload: object) {
  const instance = plainToInstance(cls, payload);
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: false });
  return { instance, errors };
}

describe('裸类型 body 收口为 DTO', () => {
  it('CreateLearningRecordDto 剥离未知字段（mass assignment 防护）', async () => {
    const { instance, errors } = await validateWhitelisted(CreateLearningRecordDto, {
      skillTreeId: 't1',
      userId: 'attacker',
    });
    expect(errors).toHaveLength(0);
    expect(instance).toEqual({ skillTreeId: 't1' });
  });

  it('CreateLearningRecordDto 缺 skillTreeId 时报错', async () => {
    const { errors } = await validateWhitelisted(CreateLearningRecordDto, {});
    expect(errors.length).toBeGreaterThan(0);
  });

  it('UpdateNodeLearningStatusDto 校验枚举', async () => {
    const ok = await validateWhitelisted(UpdateNodeLearningStatusDto, {
      status: NodeLearningStatus.COMPLETED,
    });
    expect(ok.errors).toHaveLength(0);

    const bad = await validateWhitelisted(UpdateNodeLearningStatusDto, { status: 'NOPE' });
    expect(bad.errors.length).toBeGreaterThan(0);
  });

  it('FromRecommendationDto 校验 recommendationId 必填与 type 枚举', async () => {
    const ok = await validateWhitelisted(FromRecommendationDto, {
      recommendationId: 'r1',
      type: TreeType.ENTRY,
      selectedPoints: ['a'],
    });
    expect(ok.errors).toHaveLength(0);

    const bad = await validateWhitelisted(FromRecommendationDto, { recommendationId: 'r1', type: 'X' });
    expect(bad.errors.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/learning-record/dto
```
Expected: FAIL — DTO 文件不存在。

- [ ] **Step 3: 创建三个 DTO**

`create-learning-record.dto.ts`：

```ts
import { IsUUID } from 'class-validator';

export class CreateLearningRecordDto {
  @IsUUID()
  skillTreeId: string;
}
```

`update-node-learning-status.dto.ts`：

```ts
import { IsEnum } from 'class-validator';
import { NodeLearningStatus } from '@skill/shared';

export class UpdateNodeLearningStatusDto {
  @IsEnum(NodeLearningStatus)
  status: NodeLearningStatus;
}
```

`from-recommendation.dto.ts`：

```ts
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TreeType } from '@skill/shared';

export class FromRecommendationDto {
  @IsUUID()
  recommendationId: string;

  @IsOptional()
  @IsEnum(TreeType)
  type?: TreeType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedPoints?: string[];
}
```

- [ ] **Step 4: 跑测试确认通过**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/learning-record/dto
```
Expected: PASS（4 个用例）

- [ ] **Step 5: 控制器换 DTO + 学习记录侧校验树归属**

- `learning-record.controller.ts`：`@Post()` 的 `@Body() dto: { skillTreeId: string }` → `CreateLearningRecordDto`
- `node-learning-record.controller.ts`：`@Post('nodes/:nodeId/learning-status')` 的 body → `UpdateNodeLearningStatusDto`
- `recommendation.controller.ts`：`@Post('from-recommendation')` 的 body → `FromRecommendationDto`
- `learning-record.service.ts` 的 `create(userId, skillTreeId)`：注入 `TreeAccessService`，首行 `await this.treeAccess.assertTreeOwner(skillTreeId, userId)`（私有树不允许他人挂学习记录）
- `node-learning-record.service.ts` 的 `updateStatus(userId, skillTreeId, nodeId, status)`：注入 `TreeAccessService`，首行 `await this.treeAccess.assertTreeOwner(skillTreeId, userId)` —— **校验放在 service 而非 controller**，这样它可被单测覆盖，且与其余模块的校验位置一致
- `learning-record.module.ts` 与 `recommendation.module.ts` 的 `imports` 加 `TreeAccessModule`

> 补充（同一步完成）：`learning-record.service.ts` 的 `update` 与 `remove` 已是 `{id, userId}` 作用域，无需改动；但要在 `create` 的归属校验之后保持原有「已存在则直接返回」逻辑不变。

- [ ] **Step 6: 全量回归**

```powershell
cd apps/api
node_modules\.bin\tsc --noEmit
node_modules\.bin\jest --runInBand
```
Expected: `tsc` 无错误；全部 suite 通过（原 5 个 + 本计划新增的 config / skill-tree / content / tree-node / tree-access / dto）

- [ ] **Step 7: 阶段 2 收尾提交**

```powershell
git add apps/api
git commit -m "✨ feat: 阶段 2 完成 —— DTO 收口与学习记录归属校验"
```

- [ ] **Step 8: 端到端手工验证（连真实库）**

```powershell
$env:PNPM_HOME = Join-Path (Get-Location) ".pnpm-home"
pnpm --filter api start:dev
```
然后用两个账号（`POST /api/auth/register`）验证：

| 场景 | 期望 |
|---|---|
| A 建树（`POST /api/skill-trees`） | 成功，且 `select owner_id from skill_trees` 等于 A 的 id |
| B 读 A 的树（`GET /api/skill-trees/:id`，B 的 token） | **403** |
| B 展开 A 的 L1（`POST /api/nodes/:id/expand`） | **403** |
| B 删 A 的 L1（`DELETE /api/nodes/:id`） | **403** |
| A 删有子节点的 L1 | 成功（级联生效，不再 500） |
| A 删整棵树 | 成功，且 `tree_nodes` / `node_contents` / `learning_records` 无残留 |
| `PATCH /api/nodes/:id` 带 `{"title":"x","treeId":"<别人的树>","level":1}` | 只有 `title` 生效，`treeId`/`level` 被剥离 |

> 验证完成后把结论追加到设计文档第 7 节或新建 `docs/plans/2026-09-16-phase1-2-verification.md` 记录实测结果。

---

## Self-Review 结果

**规格覆盖**：设计文档第 5 节全部条目 → Task 1–7；`5.4 归属与授权模型` → Task 8–13；`5.5 迁移基建` → Task 1 + 7；`5.6 数据处置` → Task 7 Step 1；`1.3 成功判据` 中的 schema/级联/403/迁移四条 → 本计划；**其余判据（契约化、产物状态、注册表）属于计划 B（阶段 3–5）**。

**占位符扫描**：无 TBD/TODO；每步含可执行命令与期望结果，代码块均为可直接落地的最终形态（Task 6 的三张 schema 清单即设计文档 5.2/5.3 的可执行版本）。

**类型一致性核对**：
- `TreeAccessService.assertTreeOwner` / `assertNodeOwner` 在 Task 8 定义，Task 9/10/11/12/13 均按此签名调用 ✓
- `findById(id, userId)` 在 `SkillTreeService`（Task 12）与 `TreeNodeService`（Task 9）签名一致 ✓
- `ArtifactKind` / `GenerationTaskStatus` / `AiGenerationErrorKind` 在 Task 5 定义并 build shared ✓
- Task 3 的 `codeExampleRepo` 位置（`exerciseRepo` 之后）在 Task 10 扩测试时保持一致 ✓

**已知偏差（有意为之）**：
1. Task 4 无独立单测，验证由 Task 6/7 的 schema 断言脚本承担——实体注解本身没有可单测的行为。
2. 事务化与契约校验**不在本计划**：它们属于「先算后落库」（设计文档 3.5）与契约层（3.1–3.4），由计划 B 在阶段 3 交付。因此本计划期间 `content.service` 仍是多步非原子写入（已消除 `TypeError`，但未消除部分写入）。
3. `interview` 的内存去重 Map 仍未替换为 `generation_tasks`（设计文档 1.2 明确列为后续采纳项）。

---

## Execution Handoff

计划已保存到 `docs/plans/2026-09-16-phase1-2-schema-and-authz.md`。两种执行方式：

**1. Subagent-Driven（技能默认推荐）** —— 每个 Task 派一个全新 subagent，任务间我做两阶段评审。

**2. Inline Execution** —— 在当前会话按批次执行，带检查点。

**我建议 Inline**，理由是这份计划有强顺序依赖与**共享单一真实数据库**（迁移状态、库重建是全局副作用），subagent 各自独立上下文会反复重读同一批文件、并且无法安全并行触碰同一个库；仓库体量小，inline 反而更快更稳。另外你要求「按进度完成就 commit 一个阶段」，inline 更容易在阶段边界收口提交。

你选哪种？选定后我从 Task 1 开始，按「阶段 1 完成 → 提交 → 阶段 2 完成 → 提交」的节奏推进。
