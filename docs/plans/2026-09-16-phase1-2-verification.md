# 计划 A（阶段 1–2）验证记录与执行偏差

> **日期**：2026-09-16
> **分支**：`feat/schema-authz`
> **依据计划**：`docs/plans/2026-09-16-phase1-2-schema-and-authz.md`
> **依据设计**：`docs/specs/2026-09-16-ai-contract-and-dataflow-design.md`
> **提交范围**：`6bd86e4`（T1）→ `b764247`（Cascade 修复），共 14 个提交

---

## 一、验证矩阵

| 层次 | 手段 | 结果 |
|---|---|---|
| 单元测试 | `jest --runInBand` | **11 suites / 57 tests 全绿**（阶段开始时为 5 suites / 29 tests） |
| 类型检查 | `tsc --noEmit` | exit 0 |
| 结构断言 | `ts-node scripts/verify-schema.ts` | **SCHEMA OK**（24 项断言） |
| 应用启动 | `nest start` + 真实库 | `Nest application successfully started`、全部路由已映射、问卷种子自动写入 |
| 端到端 | 真实 HTTP + 双账号 + 真实库 | **38 / 38 通过**（见第二节） |

结构断言覆盖：17 张域表集合、2 张死表已删、迁移书签表存在、7 处 `uuid` 类型、
8 处指定外键为 CASCADE、4 个唯一约束、**0 个 NO ACTION 外键**、非唯一索引恰好 19 个。

---

## 二、端到端验证明细（38 项全过）

### 2.1 越权访问 —— B 访问 A 的资源，全部 403（14 项）

| 请求 | 期望 | 实测 |
|---|---|---|
| `GET /skill-trees/:id` | 403 | 403 |
| `POST /nodes/:l1/expand` | 403 | 403 |
| `DELETE /nodes/:l1` | 403 | 403 |
| `GET /nodes/:l1/children` | 403 | 403 |
| `GET /nodes/:l2/content` | 403 | 403 |
| `POST /nodes/:l2/content` | 403（**不消耗他人 AI 额度**） | 403 |
| `GET /skill-trees/:id/interview` | 403 | 403 |
| `POST /skill-trees/:id/analysis` | 403 | 403 |
| `GET /skill-trees/:id/analysis/suggestions` | 403 | 403 |
| `PATCH /skill-trees/:id` | 403 | 403 |
| `DELETE /skill-trees/:id` | 403 | 403 |
| `POST /learning-records`（挂到他人树） | 403 | 403 |
| `POST /skill-trees/:id/nodes/:nid/learning-status` | 403 | 403 |
| 越权删除后复查数据库 | 树仍在 | 仍在 |

### 2.2 本人访问与响应契约（5 项）

- A 读自己的树 / 子节点 / L2 内容 → 200
- `GET /progress` 按 `userId` 作用域：B 调用返回 200 但结果为空数组（不是 403）——与既有实现一致
- 响应中的 `codeExamples` / `exercises` **只含前端字段**（`title,language,code` / `question,options,correctIndex,explanation`），子表内部列不再泄漏

### 2.3 mass assignment 拦截（5 项）

`PATCH /nodes/:id` 传 `{ title, treeId: <他人树>, level: '1', status: 'OUTDATED_III' }`：
- `title` 已更新 ✓
- `treeId` / `level` / `status` **均未被篡改**（数据库复核）✓

（这证明 class DTO + `whitelist: true` 生效；此前裸 TS 类型下同样的请求可以搬走节点。）

### 2.4 级联删除（4 项）

- A 删除**有子节点**的 L1 → 200（此前必然 500）
- L1 / L2 / `node_contents` 均被级联清除 ✓

### 2.5 真实建树路径（含 1 次 AI 调用）（5 项）

`POST /skill-trees` 实测：AI 生成 **8 个 L1 节点**，`owner_id = A`、自动创建 1 条学习记录；
B 读该新树 → 403；A 删整棵树 → 200，且树/节点/学习记录**均无残留**。

### 2.6 验证数据清理（1 项）

删除 `e2e-%@test.local` 用户后，用户/树/节点残留均为 0（依赖本轮修好的 `user_profiles` 级联）。

---

## 三、执行偏差记录（均为实现期发现，计划未覆盖或计划片段有缺陷）

### 3.1 计划片段本身有错（必须修正才能跑通）

| # | 计划写法 | 问题 | 实际处理 |
|---|---|---|---|
| 1 | `data-source.ts` 用 `options.host as string` | `TypeOrmModuleOptions` 是联合类型，`tsc` 报属性不存在 | 先断言为 `PostgresOptions` 形状 |
| 2 | `data-source.ts` 不加载 env | `databaseConfig()` 读 `process.env`，CLI 会连不上库 | 新增 `load-env.ts`（不引入 dotenv），CLI 内显式加载根 `.env` |
| 3 | 只改 `build()` 里的格式段；`unique: true` 与 `@OneToOne` 并存 | 各生成一条重复 UNIQUE 约束 | 去掉 `@Column` 上的 `unique: true` |
| 4 | 实体里用 `?: string \| null` | 装饰器 `design:type` 退化为 `Object`，TypeORM 抛 `DataTypeNotSupportedError`，**`nest start` 也会崩** | 去掉 7 个标量字段类型中的 `\| null` |
| 5 | 索引阈值 `>= 20` | 凭感觉定的数；实际目标 schema 是 19，且实体漏了 4 个索引 | 补 4 个索引；断言改为精确 `== 19` 并逐项注明来源 |
| 6 | Task 7 的 Step 6（注册迁移）在 Step 4（应用迁移）之后 | `migrations` 为空数组 → "No migrations are pending"，迁移静默不执行 | 调整顺序：先注册再应用 |
| 7 | `import { Client } from 'pg'` | 仓库未装 `@types/pg`，`ts-node` 在 `noImplicitAny` 下报 TS7016 | 改 `require('pg')` + 调用点声明最小类型形状 |
| 8 | Task 9 的 `tree-node.update` 写成非 Partial 的 `Pick` | 与 `UpdateNodeDto` 的可选字段冲突 | 统一用 `Partial<Pick<...>>` |
| 9 | 未考虑 TypeORM 的 `migrations` 书签表 | 「表集合 == 17」断言永远失败（实际 18 张表） | 断言排除工具表，并单独断言其存在 |
| 10 | 未考虑 `recommendation.module` 是否真需要 TreeAccessModule | 该模块并未直接注入 `TreeAccessService` | 不加无用 import |

### 3.2 计划未列出但被 `tsc`/验证暴露的连带影响

| # | 发现 | 处理 |
|---|---|---|
| 11 | 加 `owner` 关系后 `Partial<实体>` 不再满足 TypeORM 的 `_QueryDeepPartialEntity`（关系链抵达 `computedPortrait: Record<string, unknown>`），3 处 `update` 同时报 TS2345 | 三处收窄为 `Partial<Pick<Entity, 白名单列>>`（同时就是 F16 的修复） |
| 12 | `findById` 签名变更打断 **4 个**调用方（计划只提 interview/analysis，实际还有 **dashboard**、**recommendation**） | 一并传入各自 `userId`，顺带收紧这两处的越权读取 |
| 13 | T12 与 T11 存在**编译耦合**（签名变更同时打断调用方），无法拆成两个可编译提交 | 合并为一个提交（`d2ee168`），并把 T12 提前到 T11 之前 |
| 14 | `content.module` 的 `forFeature` 需加 `CodeExample` | 已补（否则 Nest 运行期无法解析注入） |
| 15 | `content.controller` 归一化后会把子表内部列（`nodeContentId`/`createdAt`）泄漏进响应 | 抽出 `toResponse` 统一映射，三处重复映射合并 |
| 16 | `shared/src/index.ts` 是**显式具名导出列表**，新增枚举必须同步 | 已同步（否则 `@skill/shared` 不导出新枚举） |
| 17 | `analysis.ignoreSuggestion` 原本未加载 `job` 关系，拿不到 `treeId` | 改为 `relations: ['job']` |
| 18 | `user_profiles.user_id` 外键为 NO ACTION，删除用户必报 500 | 改为 CASCADE + 增量迁移 + 新增「0 个 NO ACTION 外键」不变量断言 |

### 3.3 顺序与粒度调整

- **T12 提前到 T11 之前**：使 interview/analysis 可复用 `SkillTreeService.findById(id, userId)`
  一次拿到「归属校验 + 含 nodes 的树」，避免同树查两次，且 interview 少一个依赖。
- **T11 与 T12 合并提交**：见 3.2 #13。

---

## 四、沙箱环境知识（阶段 3 会再用到）

1. **pnpm 需覆盖 `PNPM_HOME`** 才能运行：`$env:PNPM_HOME = Join-Path (Get-Location) ".pnpm-home"`
   （默认路径 `C:\Users\...\AppData\Local\pnpm\global` 被沙箱拒写）。`.pnpm-home/` 已加入 `.gitignore`。
2. **`pnpm <script>` 在本沙箱不可用**：pnpm 是打包二进制，需 `spawnSync node --version` 并捕获输出，
   而沙箱禁止管道捕获子进程输出 → `EPERM`。改为直接调用 `node_modules/.bin/*`。
   ⚠️ 因此 `pnpm --filter shared build` 不可用，改跑
   `tsc -p packages/shared/tsconfig.json && tsc -p packages/shared/tsconfig.cjs.json`
   （代价：跳过了 build 脚本里的 `rm -rf dist`，如需删除产物要手动处理）。
3. **`psql -c` 里禁止写中文字面量**：控制台以 GBK 送入，psql 报「无效的 UTF8 编码字节顺序」。
   需要中文时用 `-f` 执行 UTF-8 脚本文件，或用 `chr()`。
4. **PowerShell 重定向会显示假乱码**：`Start-Process -RedirectStandardOutput` 后读回日志时中文会显示成
   `浣犲綋鍓?` 形态。判定数据是否真损坏必须查库（`like '%'||chr(65533)||'%'`），不可看日志。
5. **`tree_nodes.level` 是字符串枚举**（DB 里是 `'1'/'2'/'3'`，不是整数）——TypeORM 把数字 TS 枚举映射成了
   字符串枚举。手写 SQL 时必须写 `level = '1'`，否则报「操作符不存在: tree_nodes_level_enum = integer」。
6. **`@skill/*` 有两条解析路径**：`tsc` 走 `packages/*/src`（paths 映射），而 jest/ts-node/nest 运行时走
   `node_modules` → `packages/*/dist`。改了共享包源码后 `tsc` 会通过，但测试会在运行时报「没有导出成员」。

---

## 五、当前库状态与备份

- 库 `skill_learning`：**17 张域表 + 1 张 `migrations` 书签表**，已应用 2 个迁移
- 数据：0 用户 / 0 技能树 / 0 节点 / 8 条问卷种子题目（E2E 数据已清理干净）
- 备份（不入版本库，见 `.gitignore`）：
  - `backups/2026-09-16-full-db/`（重建前的全库，dump + sql）
  - `backups/2026-09-16-orphan-trees/`（6 棵孤儿树）

---

## 六、遗留事项（交给阶段 3+）

| 事项 | 归属 |
|---|---|
| AI 输出无契约校验、4 处消费点无守卫（现已在 3 处补 `\|\| []`，但无形状校验） | 阶段 3（zod 契约层） |
| 三处写路径仍非原子（compute-then-write 事务） | 阶段 3 |
| `ai_generations` 审计表已建但尚无写入方 | 阶段 3 |
| `generation_tasks` 已建但尚无使用方；`interview` 的内存去重 Map 仍保留 | 阶段 4 |
| `generateL3` 仍是一次返回三个业务的合并调用 | 阶段 4 |
| 「过期 → 重新生成」流程仍缺失；`NodeContent.version` 仍恒为 1 | 阶段 5 |
| 鉴权仍在服务层（未 Guard 化）；`skill_trees.keywords` 只写不读；`tree_nodes.level` 枚举含未使用的 L3 | 后续候选 |
| `packages/shared/src/index.ts` 的显式具名导出列表需人工同步 | 后续候选（改为 `export * from './enums'` 更稳，但会改变现有导出风格） |
