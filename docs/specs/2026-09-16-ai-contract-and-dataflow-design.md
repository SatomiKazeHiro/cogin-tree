# AI 契约层与数据流重构 · 设计文档

> **状态**：待用户评审（评审通过后进入实施计划）
> **日期**：2026-09-16
> **范围**：`apps/api`、`packages/prompt-manager`、`packages/shared`、`apps/web`（局部）
> **依据**：本文所有"现状"结论均在本地 PostgreSQL 18.4 / 库 `skill_learning` 上实测，复现命令见第 10 节

---

## 0. 背景与实测证据

### 0.1 触发点

原始疑问是"所有业务都依赖 AI 返回 JSON，是不是有隐患、不够规范"。调研后确认：隐患真实存在，而且**不止于校验**——真正的机会在于把"为省 token 而合并的 AI 调用"重新拆开，让业务边界、数据流与交互一并变清晰。

### 0.2 实测事实（决定了设计取舍）

| # | 事实 | 证据 |
|---|---|---|
| F1 | 9 个 stage 的 `parse` 全是裸 `extractJson` + 类型断言，**零形状校验** | `packages/prompt-manager/src/templates/*.ts` 全部 `parse: extractJson` |
| F2 | 现有测试只覆盖 JSON **语法**（代码块/夹杂文字/截断），无一条形状断言 | `apps/api/src/modules/ai-integration/extract-json.spec.ts` |
| F3 | **4 处消费点无守卫**，模型少返回一个 key 就 `TypeError` → 500 | `skill-tree.service.ts:46`、`tree-node.service.ts:62`、`content.service.ts:65`、`portrait-ai.service.ts:53` |
| F4 | **无任何事务**（全仓库仅 1 处 `createQueryBuilder` 用于 delete） | 创建树/写 L3 内容/提交肖像均为多步非原子写入 |
| F5 | 已在库中产生脏数据：14 棵树中 **6 棵无学习记录**，其中 1 棵 **0 节点 0 内容 0 学习记录** | 见 0.3 |
| F6 | `generateL3` 是**唯一仍在合并的调用**：一次返回 coreText + codeExamples + exercises 三个业务，且 `max_tokens: 8192` + 推理模型 → 最慢、最易截断、唯一有"存一半就 500"的路径 | `content.service.ts:51-77` |
| F7 | 它同时有**静默永久降级**：内容行写入后 `exercises.map` 抛错 → 500；用户重试时 `generateContent` 发现内容已存在**直接 return**（`content.service.ts:37-40`），该节点永久 0 道练习题 | 同上 |
| F8 | `NodeContent.version` 写死为 1、永不递增，`updateContent` 也不 bump → 残废字段 | `content.service.ts:61` |
| F9 | **全仓库无 regenerate 端点**（仅 recommendations 有 refresh）→ 内容生成后无法更新；节点被标 OUTDATED 后无"按新版重生成"的流程 | `grep -i regenerat` 零命中 |
| F10 | 无迁移：`synchronize: NODE_ENV !== 'production'`，无 migration 文件 | `config/database.config.ts:41` |
| F11 | synchronize 只加不删 → **已发生 schema 漂移**：库里 16 张表，代码只注册 14 张（`global_configs`、`recommendation_jobs` 为死表） | 见 0.3 |
| F12 | **14 张表 0 个非唯一索引**（21 个索引全是 PK/unique 自带）→ 所有 FK 列与热点查询列全表扫 | 见 0.3 |
| F13 | FK 建不起来的根因是**类型错配**：7 处 `varchar` 存 UUID。实体写成裸 `@Column`（无 `@ManyToOne`）时 TypeORM 推断为 `varchar`，导致外键**物理上无法创建** | 见 0.3 |
| F14 | 外键删除行为实测：`tree_nodes.parent_id` / `node_contents.node_id` / `tree_nodes.tree_id` 全为 `NO ACTION` → 删有子节点的 L1、删有内容的 L2 必然 500 | `confdeltype=a`，见 0.3 |
| F15 | **无归属字段**：`skill_trees` 无 owner；`tree-node`/`skill-tree`/`content`/`interview`/`analysis` 控制器**从不读取 `req.user`** → 任何登录用户可按 id 读改删他人树、并用他人树消耗 API 额度。对照组：`learning-record` 是全仓库唯一做了 `{id, userId}` 作用域的模块 | `tree-node.controller.ts` 全文无 `req.user` |
| F16 | 6 处 request body 用**裸 TS 类型**而非 DTO class → `ValidationPipe({whitelist:true})` 失效 → `nodeRepo.update(id, data)` 直通，客户端可改 `treeId`/`level`/`parentId`（搬走节点），或给内容行改 `node_id` | `content.controller.ts:48`、`tree-node.controller.ts:38` 等 |
| F17 | 库中 `skill_trees.name` 7 行、`tree_nodes.title` 12 行、`node_contents.core_text` 1 行含 **U+FFFD 不可逆损坏**（UTF-8 被按 GBK 解读的双重编码），集中在 `testtree`/`testuser`/`uitest` 三个测试账号 | 见 0.3 |
| F18 | 该库 **100% 是测试数据**：9 个用户全为 `test*` 账号 | 见 0.3 |
| F19 | 并发去重用**内存 `Map<id, Promise>`**（`interview.service.ts:15`、`recommendation.service.ts:21`）→ 重启即失效，多实例下失效 | |

### 0.3 关键实测输出（复现命令见第 10 节）

```
表与精确行数：users 9 / skill_trees 14 / tree_nodes 99 / node_contents 11 / recommendations 54
表总数：16（代码只注册 14；global_configs 与 recommendation_jobs 为死表）
索引：total 21 / non_unique 0
外键删除行为：tree_nodes.parent_id=a, node_contents.node_id=a, tree_nodes.tree_id=a,
             exercises.node_content_id=c, interview_questions.*=c, analysis_jobs.tree_id=c
类型错配（varchar 存 UUID）：
  learning_records.user_id, learning_records.skill_tree_id,
  node_learning_records.user_id, node_learning_records.skill_tree_id, node_learning_records.node_id,
  recommendations.user_id（同表内 skill_tree_id 却是 uuid）,
  suggested_changes.parent_node_id, suggested_changes.target_node_id
孤儿树：6 棵（1 棵 0 节点/0 内容/0 学习记录，其余 3-6 节点、0 内容）
U+FFFD 损坏：skill_trees.name 7 行、tree_nodes.title 12 行、node_contents.core_text 1 行
```

---

## 1. 目标与范围

### 1.1 目标

1. **契约化**：AI 输出从"隐式 schema"降级为"输入"——由一份可执行契约（zod）定义、运行时校验、并由同一份契约生成提示词中的格式说明，从根上消除格式漂移。
2. **数据流重构**：按"一个 AI 调用 = 一个业务产物 = 一份契约 = 一个状态"拆开合并调用；生成时机跟随消费时机（懒生成/预取）；产物状态显式化；失败局部可恢复。
3. **表结构与归属工程化**：迁移基建、类型修正、索引、唯一约束、级联统一、私有归属与授权、AI 调用审计表。

### 1.2 本轮明确不做（及理由）

| 不做 | 理由 |
|---|---|
| 建树异步化（建树即返回 + 后台生成 L1 + 前端轮询） | L1 生成仅 2–5s，等待可接受；孤儿树问题由"先算后落库"根治。异步化要引入轮询 UI 与任务状态，收益不匹配成本。`generation_tasks` 已为将来留好通道 |
| 节点内容**版本历史表** | 业务表只保留当前版本（覆盖式更新 + `version` 递增）；可追溯性由 `ai_generations.raw_response` 承载，不另建历史表 |
| 面试题（stage 6）改用 `generation_tasks` | 刚完成按节点重构，避免重复改动；其内存去重 Map 暂留（不比现状更差），列为后续采纳项 |
| 前端可视化（用户有想法） | 用户明确暂不做；本轮只保证数据流不阻塞它 |
| "复用已有输入"的具体生成策略 | 用户明确暂不做；本轮只**留出通道**（生成入参结构支持携带画像/学习记录/兄弟节点/历史产物摘要） |
| `skill_trees.keywords` 类型统一为 `text[]` | 该字段目前**只写不读**，属死字段；本轮不动，仅记录为后续清理候选 |
| 鉴权从"服务层校验"升级为 Guard | 本轮在服务层做 owner 校验（改动小、易测）；Guard 化列为后续 |

### 1.3 成功判据

- 任一 stage 的输出形状错误 → 抛出**结构化** `AiContractError`，绝不落库、绝不 500 静默降级
- 删除有子节点的 L1 / 有内容的 L2 **不再报错**（级联生效）
- 非创建者访问他人树/节点 → **403**
- 每个 AI 产物有显式状态，前端可区分"生成中 / 失败可重试 / 就绪 / 合法的空"
- `synchronize` 关闭，schema 变更全部走 migration；库中不再有死表
- 一次 AI 调用可从 `ai_generations` 追溯到 stage / prompt 版本 / 模型 / 耗时 / token / 原始响应

---

## 2. 设计原则

### 2.1 数据流五原则

1. **一个 AI 调用 = 一个业务产物 = 一份契约 = 一个状态**——不可再分的最小单位
2. **生成时机跟随消费时机**：用户要读时才生成、要练时才生成；能预取的后台预取
3. **产物有显式状态**（未生成 / 生成中 / 就绪 / 失败），不用"表里有没有行"去猜——现有实现正是这个猜法让"0 道练习题"与"合法空数组"无法区分（F7）
4. **失败局部可恢复**：单个产物失败不拖垮节点，也不静默降级；每个产物可独立重试与重新生成
5. **已有输入复用**：生成入参预留画像 / 学习记录 / 兄弟节点 / 历史产物摘要通道

### 2.2 拆分不是省钱（重要的反直觉结论）

token 单价下降**不构成**"可以无差别拆细"的论证：

- ❌ 拆分让**总 token 上升**——每次调用都要重复背景上下文（技能树名 / L1 / L2 标题 / 产物摘要）
- ❌ 调用次数↑、部分失败面↑（必须有状态机兜底）
- ✅ 真实收益：边界清晰可维护、**单次更小 → 截断/超时/形状错误概率显著下降**、失败可局部重试、可独立观测与计费

**结论**：只在"最慢最易坏"的 `generateL3` 上开刀，不做无差别拆分。

### 2.3 拆分必须与生成时机配对

若把 stage-3 拆成 3 次调用却仍在"点开 L2"时同步全做完，用户等待从 1×20s 变成 3×~8s——**交互反而更差**。见 4.3 的配对方案。

---

## 3. AI 契约层设计（已评审通过）

### 3.1 结构：契约与模板同居

```
packages/prompt-manager/src/
├── prompt-engine.ts        # PromptTemplate 增加 schema；AiContractError；extractJson（保留）
├── schemas/common.ts       # 复用原子 schema：nodeItem / codeExample / exerciseItem / qaItem
├── templates/stage-0..N    # 每个 stage 自带顶层 schema + build（格式段由 schema 生成）
└── prompt-manager.ts       # parse() 内部做 schema 校验
```

选型理由：契约与提示词**物理同居**，改一个 stage 只动一个文件；新建独立包在无第二消费方前是纯负债。

### 3.2 接口收敛，消灭 9 份样板

```ts
export interface PromptTemplate<TInput, TOutput> {
  version: string;                    // 语义化版本，并落库到 ai_generations
  schema: z.ZodType<TOutput>;         // 唯一契约来源
  build: (input: TInput) => string;
  parse: (raw: string) => TOutput;    // 默认实现 = schema.parse(extractJson(raw))
}

// helper：传入 schema + build，自动生成 parse 并注入格式段
export function defineTemplate<TIn, TOut>(def: {
  version: string;
  schema: z.ZodType<TOut>;
  build: (input: TIn, format: string) => string;
}): PromptTemplate<TIn, TOut>;
```

顺带修掉现存的版本不一致（`'v1'` / `'1.0.0'` / `'2.0.0'` 混用）。

### 3.3 同源注入

提示词中的"输出格式"段落不再手写，由 schema 派生：

- schema 每个字段用 zod v4 的 `.meta({ description: '中文说明' })` 标注
- 注入内容取 `z.toJSONSchema(schema, { target: 'draft-07' })` → `description` / `required` / `enum` 全部来自 schema，且 description 是中文（兼顾模型友好度与"不可能漂移"）

依赖情况：**zod v4 内置 `z.toJSONSchema()`，无需额外依赖**（参考 <https://zod.dev/json-schema>）。

**成本**：提示词长度增加，估算 +200~400 tokens/stage。接受该成本以换取契约不可漂移。
**备选**（若成本敏感）：格式段仍手写中文说明，改用一条测试断言"手写说明的字段集 == schema 字段集"来防漂移。

### 3.4 错误分层

```ts
export class AiContractError extends Error {
  stage: PromptStage;
  kind: 'invalid_json' | 'truncated' | 'schema_mismatch';
  issues?: z.core.$ZodIssue[];   // 字段级错误，可回灌给模型
  raw: string;
}
```

统一失败策略（在 `ai-integration` 一处实现）：**校验失败 → 把 issues 摘要回灌模型重试 1 次（temperature 调低）→ 仍失败抛 502（`AiContractError`），且绝不落库**。

### 3.5 计算-后-落库（AI 调用移出事务）

不在事务里等 AI（10~30s 会长时间占用连接）。统一模式：

```
① 调 AI（无事务，可重试，可校验）
② 得到校验通过的 payload
③ 一个短事务写全部落库动作 → COMMIT
```

三处受益：`skill-tree.create`（树+节点+学习记录）、`content.generate`（内容+代码示例+练习）、`portrait.submit`（答案替换+画像）。这同时根治 F5 的孤儿树。

**取舍**：若第 ③ 步失败，第 ① 步的 AI 成本白花。**一致性优先于省一次调用**（已确认）。

### 3.6 观测：`ai_generations` 表

每次 AI 调用落一行；重试各占一行。它是"这行数据是谁、用哪个 prompt 版本、哪个模型生成的"的唯一手段，也是成本统计与模型回归的基线。字段见 5.2。

### 3.7 测试策略

- 每个 stage：正例 + 反例（缺字段 / 类型错 / 枚举越界 / 数组元素错 / 空数组 / 超长）
- 校验失败重试后仍失败 → **断言无任何 DB 写入**（mock repo）
- 断言 build 产出的格式段与 schema 一致（3.3 的防漂移测试）
- 保留现有 `extractJson` 语法层测试

---

## 4. 产物状态机与拆分

### 4.1 两层模型：意图/状态 vs 执行/审计

| 层 | 表 | 一行代表 | 回答的问题 |
|---|---|---|---|
| 意图/状态 | `generation_tasks` | "某节点上某类产物的当前生成意图与状态" | 现在是什么状态？能不能重试？谁在生成？ |
| 执行/审计 | `ai_generations` | "一次真实的 AI 调用" | 这次为什么失败？用的哪个版本/模型？花了多少？ |

选此模型而非"每个产物表加状态列"的理由：`exercises` / `code_examples` 是**集合级产物**，状态是集合属性，塞进首行会很别扭；且 `generation_tasks` 天然给出**幂等键**（`UNIQUE(node_id, artifact_kind)`），替代 F19 的内存 Map。

### 4.2 `generateL3` 拆分为三个 stage

| 新 stage | 产物 | 落库目标 |
|---|---|---|
| `l3-core-text` | coreText | `node_contents.core_text` |
| `l3-code-examples` | codeExamples | `code_examples` 表（对称归一化，与 `exercises` 一致） |
| `l3-exercises` | exercises | `exercises` 表 |

每个 stage 各自有 zod 契约、各自可独立失败/重试/重新生成。

### 4.3 生成时机与交互配对

| 产物 | 生成时机 | 阻塞用户? | 前端表现 |
|---|---|---|---|
| coreText | 点开 L2（用户马上要读） | 阻塞（但单次更小更快更不易截断） | 骨架屏 → 正文 |
| codeExamples | coreText 到达后后台预取（读文字时不需要） | 不阻塞 | 正文下方先占位，就绪后出现 |
| exercises | 点"开始练习"时生成，或读完后后台预取 | 不阻塞 | 独立区块：生成中 / 失败重试 / 就绪 |

收益：**首屏可读时间下降**（只等最小的那个），而非"3 次等待叠加"。

### 4.4 并发与幂等

- 生成入口对 `(node_id, artifact_kind)` 做**数据库级**幂等：`INSERT ... ON CONFLICT DO NOTHING` 抢 `generation_tasks` 行；抢不到说明已在生成中 → 直接返回当前状态
- `status = GENERATING` 且 `started_at` 超时（如 120s）视为僵死，可被重新认领
- 彻底替代 `Map<id, Promise>`（F19）

---

## 5. 目标表结构

### 5.1 表清单变动

| 动作 | 表 | 说明 |
|---|---|---|
| 新增 | `code_examples` | codeExamples 归一化 |
| 新增 | `ai_generations` | AI 调用审计 |
| 新增 | `generation_tasks` | 产物生成意图与状态 |
| 删除 | `global_configs` | 死表（实体已删） |
| 删除 | `recommendation_jobs` | 死表（定时任务未实现） |
| 修改 | `skill_trees` | +`owner_id` NOT NULL（FK → users）；+索引 |
| 修改 | `tree_nodes` | 级联改 CASCADE；+索引 |
| 修改 | `node_contents` | 删 `code_examples` json 列；`node_id` 级联 CASCADE |
| 修改 | `learning_records` | 类型 uuid + FK + 唯一约束 |
| 修改 | `node_learning_records` | 类型 uuid + FK + 唯一约束 |
| 修改 | `recommendations` | `user_id` 类型 uuid + FK；`skill_tree_id` 级联 SET NULL |
| 修改 | `suggested_changes` | `parent_node_id` / `target_node_id` 类型 uuid + FK SET NULL |
| 修改 | `portrait_answers` | `question_id` 级联 CASCADE |
| 修改 | `user_profiles` | +`portrait_schema_version` |
| 不变 | `users` / `interview_questions` / `analysis_jobs` / `portrait_questions` / `exercises`（除索引） | |

最终表数：**17**（现状 16 张 − 2 张死表 + 3 张新增；`node_contents` 的 json 列转为表不改变表数）

### 5.2 逐表定义

#### 新增 `code_examples`

| 列 | 类型 | 约束 |
|---|---|---|
| id | uuid | PK |
| node_content_id | uuid | NOT NULL, FK → `node_contents(id)` **ON DELETE CASCADE** |
| title | varchar | NOT NULL |
| language | varchar | NOT NULL |
| code | text | NOT NULL |
| sort_order | int | NOT NULL DEFAULT 0 |
| created_at / updated_at | timestamp | |

索引：`(node_content_id)`

#### 新增 `ai_generations`

| 列 | 类型 | 约束 / 说明 |
|---|---|---|
| id | uuid | PK |
| stage | varchar | 如 `l3-core-text` |
| prompt_version | varchar | 模板 version |
| provider / model | varchar | 如 `deepseek` / `deepseek-v4-flash` |
| user_id | uuid | NULL, FK → `users(id)` ON DELETE SET NULL |
| tree_id | uuid | NULL, FK → `skill_trees(id)` ON DELETE SET NULL |
| node_id | uuid | NULL, FK → `tree_nodes(id)` ON DELETE SET NULL |
| request_hash | varchar | 入参摘要，用于识别重复请求 |
| raw_response | text | 原始响应（可能不是合法 JSON，故用 text） |
| parsed_ok | boolean | 是否通过契约校验 |
| error_kind | varchar | NULL / `invalid_json` / `truncated` / `schema_mismatch` / `provider_error` |
| error_detail | text | NULL，issues 摘要 |
| prompt_tokens / completion_tokens | int | NULL |
| latency_ms | int | |
| attempt | int | 从 1 起，重试各占一行 |
| created_at | timestamp | |

索引：`(created_at)`、`(tree_id, created_at)`、`(stage, created_at)`
清理策略：保留策略后续定（本轮不做自动清理）

#### 新增 `generation_tasks`

| 列 | 类型 | 约束 / 说明 |
|---|---|---|
| id | uuid | PK |
| node_id | uuid | NOT NULL, FK → `tree_nodes(id)` ON DELETE CASCADE |
| artifact_kind | enum | `L3_CORE_TEXT` / `L3_CODE_EXAMPLES` / `L3_EXERCISES` |
| status | enum | `PENDING` / `GENERATING` / `READY` / `FAILED` |
| attempts | int | NOT NULL DEFAULT 0 |
| last_error | text | NULL |
| prompt_version / model | varchar | NULL，最后一次成功的版本与模型 |
| started_at / finished_at | timestamp | NULL |
| created_at / updated_at | timestamp | |

约束与索引：**`UNIQUE(node_id, artifact_kind)`**（幂等键）、`(status)`

#### 修改 `skill_trees`

- **+`owner_id` uuid NOT NULL, FK → `users(id)` ON DELETE CASCADE**
- 索引 `(owner_id)`
- `keywords` varchar 保持不动（只写不读的死字段，仅记录）

#### 修改 `tree_nodes`

- `tree_id` FK → **ON DELETE CASCADE**
- `parent_id` FK → **ON DELETE CASCADE**（删 L1 连带其 L2，根治 F14）
- 索引：`(tree_id)`、`(parent_id)`、`(tree_id, level)`
- `level` 枚举中的 `L3` **从未被写入**（实测：level=1 共 56 行、level=2 共 43 行、无 level=3；L3 内容走 `node_contents`）。本轮**保留不清理**——收缩枚举需要额外迁移且收益低，仅记录为后续候选

#### 修改 `node_contents`

- **删除 `code_examples` json 列**（改为 `code_examples` 表）
- `node_id` FK → **ON DELETE CASCADE**
- `version` 语义修正：重新生成时递增（不再恒为 1）
- `node_id` 已有 unique 索引

#### 修改 `learning_records`

- `user_id` → **uuid**, FK → `users(id)` ON DELETE CASCADE
- `skill_tree_id` → **uuid**, FK → `skill_trees(id)` ON DELETE CASCADE
- **`UNIQUE(user_id, skill_tree_id)`**（根治并发重复行）
- 索引：`(user_id)`、`(skill_tree_id)`

#### 修改 `node_learning_records`

- `user_id` → **uuid** FK `users` CASCADE
- `skill_tree_id` → **uuid** FK `skill_trees` CASCADE
- `node_id` → **uuid** FK `tree_nodes` CASCADE
- **`UNIQUE(user_id, node_id)`**
- 索引：`(user_id, skill_tree_id)`、`(node_id)`

#### 修改 `recommendations`

- `user_id` → **uuid** FK `users` CASCADE
- `skill_tree_id` 保持 nullable，FK → **ON DELETE SET NULL**（当前 `skill-tree.service.remove` 手工置 null 的逻辑可随之简化）
- 索引：`(user_id, is_active)`

#### 修改 `suggested_changes`

- `parent_node_id` / `target_node_id` → **uuid** FK `tree_nodes` **ON DELETE SET NULL**（保留建议审计，仅断引用）
- 索引：`(job_id)`、`(status)`

#### 修改 `portrait_answers`

- `question_id` FK → **ON DELETE CASCADE**

#### 修改 `user_profiles`

- **+`portrait_schema_version` varchar NULL**（zod 契约版本，配合 computedPortrait 校验）

### 5.3 索引清单汇总（含理由）

| 表 | 索引 | 对应查询 |
|---|---|---|
| skill_trees | (owner_id) | 我的技能树 |
| tree_nodes | (tree_id), (parent_id), (tree_id, level) | 取树节点 / 子节点 / 按层过滤 |
| node_contents | (node_id) unique | 取 L2 内容 |
| code_examples | (node_content_id) | 取代码示例 |
| exercises | (node_content_id) | 取练习题 |
| learning_records | (user_id), (skill_tree_id), UNIQUE(user_id, skill_tree_id) | 仪表盘 / 删树 / 去重 |
| node_learning_records | (user_id, skill_tree_id), (node_id), UNIQUE(user_id, node_id) | 进度 / 最近学习 / 去重 |
| recommendations | (user_id, is_active) | 活跃推荐 |
| interview_questions | (l2_node_id), (tree_id) | 按节点聚合 / 按树清理 |
| analysis_jobs | (tree_id) | 待处理建议 |
| suggested_changes | (job_id), (status) | 建议列表 |
| generation_tasks | UNIQUE(node_id, artifact_kind), (status) | 状态查询 / 幂等 |
| ai_generations | (created_at), (tree_id, created_at), (stage, created_at) | 审计 / 成本统计 |

### 5.4 归属与授权模型

- **私有归属**：`skill_trees.owner_id` NOT NULL；只有创建者可读写
- 授权在**服务层**实施（本轮），规则：
  - 树相关：`skill_trees.owner_id === userId`
  - 节点/内容相关：join 到 `tree_nodes.tree_id` → `skill_trees.owner_id === userId`
  - 越权统一抛 **403**（新增 `ForbiddenException` 语义），而非 404（便于前端区分）
- 覆盖范围：`skill-tree` / `tree-node` / `content` / `interview` / `analysis` 的**全部**读写端点
- 学习记录相关端点沿用现有 `{id, userId}` 作用域写法（已是正确范式）

### 5.5 迁移基建

- 新增 `apps/api/src/config/data-source.ts`（供 TypeORM CLI 使用的 `DataSource`）
- 新增 `apps/api/src/migrations/`，首个迁移为 `InitialSchema`（完整目标 schema）
- `database.config.ts`：**`synchronize: false`**、`migrations` 显式注册
- `package.json` 新增脚本：`migration:generate` / `migration:run` / `migration:revert`
- 初始迁移生成方式：drop 并重建空库 → 用 `migration:generate` 从实体生成完整 CREATE（含 PG enum 类型）→ 人工评审后提交（比手写可靠）

### 5.6 本地库重建与数据处置（已决策）

1. **全库备份已完成**：`backups/2026-09-16-full-db/skill_learning.dump`（可恢复）+ `.sql`（可读）
2. **孤儿树备份已完成**：`backups/2026-09-16-orphan-trees/`（6 棵树 / 18 节点）
3. 重建后库为**空**（除种子问卷题目）。旧备份是**安全网**而非回导路径（旧 schema 与新 schema 不兼容）
4. 用户已确认：库内 100% 为测试数据，接受丢失（F18）
5. F17 的 U+FFFD 损坏数据随重建消失，**无需单独修复**

---

## 6. 接口变更

### 6.1 新增

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/nodes/:id/artifacts` | 三类产物的**状态 + 已就绪内容**（前端分块渲染依据） |
| POST | `/nodes/:id/artifacts/:kind/generate` | 生成指定产物（幂等，走 `generation_tasks`） |
| POST | `/nodes/:id/artifacts/:kind/regenerate` | **重新生成**（"过期 → 更新"流），`version` 递增 |

### 6.2 变更

| 方法 | 路径 | 变更 |
|---|---|---|
| POST | `/nodes/:id/content` | 语义收窄为"确保 coreText 存在"（等价于 generate `L3_CORE_TEXT`）；保留以兼容 |
| GET | `/nodes/:id/content` | 保留为**聚合读**（向后兼容），响应新增各产物状态 |

### 6.3 前端影响（Phase 4 内）

- `TreeL2ContentPanel`：改为**分块加载**——coreText 阻塞展示，codeExamples / exercises 独立区块各自呈现"生成中/失败重试/就绪"
- 新增"重新生成"入口（Phase 5），承接节点 OUTDATED 状态
- `packages/shared` 的 `NodeContent` 接口与前端类型同步更新

---

## 7. 实施阶段与依赖顺序

| 阶段 | 内容 | 依赖 | 可独立验证的产出 |
|---|---|---|---|
| **1** | 迁移基建 + 目标 schema + 实体改造 + 直接受影响的读写适配（`owner_id` 写入、`code_examples` 改表） | 无 | 迁移可跑；库为 17 张表、0 死表、索引/约束/级联就位；typecheck 通过 |
| **2** | 授权收口（owner 校验铺到 5 个模块）+ 6 处裸 DTO 换 class DTO | 阶段 1 | 越权返回 403；mass assignment 被 whitelist 拦截（含测试） |
| **3** | AI 契约层：zod 契约 + `defineTemplate` + 同源注入 + `AiContractError` + 重试 + 计算后落库事务 + `ai_generations` 落库 | 阶段 1（表） | 每个 stage 的契约测试；失败不落库的断言；审计表有数据 |
| **4** | 产物状态机 + `generateL3` 拆三个 stage + 懒生成/预取 + 前端分块 | 阶段 1、3 | 首屏可读时间下降；部分失败可重试；`UNIQUE(node_id, artifact_kind)` 生效 |
| **5** | 过期 → 重新生成流（regenerate + `version` 递增 + 前端入口） | 阶段 4 | 标 OUTDATED 的节点可重新生成并更新内容 |
| **6** | 回归：`typecheck` + `jest` + **真连库端到端跑一遍** | 全部 | 全绿 + 端到端实测记录 |

顺序理由：schema 先行因为它被阶段 3/4 共同依赖（审计表、产物表）；授权紧随其后，因为 `owner_id` 一落地它就只是小改动，而它是当前最易被利用的洞（F15）；契约层是拆分（阶段 4）的使能器。

**关于计划拆分**：阶段 1–2（表结构 + 授权）与阶段 3–5（契约层 + 拆分 + 重生成）虽有依赖关系，但前者交付后即可独立验证与暂停。若实施时希望降低单次改动面，可拆成两个实施计划：**计划 A = 阶段 1–2**，**计划 B = 阶段 3–5**（阶段 6 回归在各自末尾各做一次）。

---

## 8. 风险与取舍

| 风险 | 影响 | 应对 |
|---|---|---|
| 迁移不可逆 | 重建后旧数据不可用 | 已全库备份（dump + sql）；孤儿树单独备份 |
| 阶段 1 体量偏大（schema + 实体 + 读写适配耦合） | 单次改动面广 | 阶段 1 只做"让代码在新 schema 下编译并正确读写"的最小适配；拆分/状态机留阶段 4 |
| 提示词变长（3.3 注入） | token 成本上升 | 已量化估算；备选方案已给出（手写说明 + 防漂移测试） |
| 拆分后部分失败面变大 | 用户看到半成品 | 显式状态机 + 局部重试；前端分块呈现 |
| 多轮 AI 调用总成本上升 | 成本 | 只在最慢最易坏的 stage 拆分；`ai_generations` 提供成本可观测性，便于回滚决策 |
| 阶段 4 改动前端 | 交互回归 | 分块渲染保持向后兼容的聚合读接口 |
| 迁移后本地库为空（重建后无用户与树） | 无法立即手工验证 UI | 可选 dev seed 脚本（建 1 个测试用户 + 1 棵最小树），列为**可选任务**而非阶段 |

---

## 9. 决策记录（本轮已锁定）

| # | 决策 | 取值 |
|---|---|---|
| D1 | 推进范围 | 路线 A（AI 契约层）+ 路线 B（表结构工程化）均做 |
| D2 | 树归属 | **私有**：`skill_trees.owner_id` NOT NULL，仅创建者可读写 |
| D3 | 孤儿树 | 先备份，重建时一并删除（备份已完成） |
| D4 | 开发库策略 | 全库备份 → **干净重建**（库内 100% 测试数据） |
| D5 | 校验层 | **zod v4**（内置 `z.toJSONSchema()`，无额外依赖） |
| D6 | 归一化 | **对称**：codeExamples 拆表；computedPortrait 保留 jsonb + zod 校验 + schema 版本列 |
| D7 | 契约层位置 | **方案 1**：内聚在 `packages/prompt-manager` |
| D8 | 产物状态模型 | `generation_tasks`（意图/状态）+ `ai_generations`（执行/审计）两层 |
| D9 | 内容版本策略 | 覆盖式更新 + `version` 递增；历史由 `ai_generations.raw_response` 承载，不建历史表 |
| D10 | 建树异步化 | 本轮不做（L1 生成仅 2–5s；孤儿树由"先算后落库"根治） |
| D11 | AI 调用位置 | 移出事务：先算后落库（一致性优先于省一次调用） |
| D12 | 鉴权位置 | 服务层 owner 校验（Guard 化列为后续） |

---

## 10. 附录：实测证据复现命令

```powershell
# 读取 .env 中的密码并连接（PostgreSQL 18.4，库 skill_learning）
$pw = ((Get-Content .env | Where-Object { $_ -match '^DB_PASSWORD=' }) -replace '^DB_PASSWORD=','').Trim()
$env:PGPASSWORD = $pw; $env:PGCLIENTENCODING = 'UTF8'
$psql = "D:\Environment\PostgreSQL\18\bin\psql.exe"

# 表与索引（F11/F12）
& $psql -h localhost -p 5432 -U postgres -d skill_learning -c "select relname from pg_stat_user_tables order by 1;"
& $psql -h localhost -p 5432 -U postgres -d skill_learning -tAc "select count(*) total, count(*) filter (where indexdef not like '%UNIQUE%') non_unique from pg_indexes where schemaname='public';"

# 外键删除行为（F14）
& $psql -h localhost -p 5432 -U postgres -d skill_learning -c "select conrelid::regclass tbl, a.attname col, confdeltype from pg_constraint c join unnest(c.conkey) k on true join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k where c.contype='f';"

# 类型错配（F13）
& $psql -h localhost -p 5432 -U postgres -d skill_learning -tAc "select table_name||'.'||column_name||' -> '||data_type from information_schema.columns where table_schema='public' and column_name like '%\_id' order by data_type, 1;"

# 孤儿树（F5）
& $psql -h localhost -p 5432 -U postgres -d skill_learning -c "select t.name, (select count(*) from tree_nodes n where n.tree_id=t.id) nodes from skill_trees t where not exists (select 1 from learning_records lr where lr.skill_tree_id=t.id::text);"

# U+FFFD 损坏统计（F17）
& $psql -h localhost -p 5432 -U postgres -d skill_learning -tAc "select 'skill_trees.name', count(*) from skill_trees where name like '%'||chr(65533)||'%' union all select 'tree_nodes.title', count(*) from tree_nodes where title like '%'||chr(65533)||'%';"
```

> ⚠️ 注意：用 `psql -c` 时**不要在 SQL 里写中文字面量**——控制台会以 GBK 编码送入，psql 报"无效的 UTF8 编码字节顺序"。改用 `chr()` 或纯 ASCII；需要中文时用 `-f` 执行 UTF-8 脚本文件。
