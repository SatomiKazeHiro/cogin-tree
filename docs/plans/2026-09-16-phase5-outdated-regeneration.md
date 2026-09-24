# 计划 D 实施计划：过期 → 重新生成流（阶段 5）

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通「节点被标记过期 → 用户重新生成 → 内容真的换新」这条链路。今天它是一个死胡同：`analysis` 只把 `node.status` 改成 `OUTDATED_*`，而 `generation_tasks` 的认领条件把 `READY` 排除在外，因此**已生成的内容没有任何重新生成入口**，`NodeContent.version` 的自增代码永远不触发（恒为 1），节点状态也无法改回 `ACTIVE`。

**Architecture:** 不新建表、不加迁移。在既有的「意图/状态（`generation_tasks`）+ 执行/审计（`ai_generations`）」两层模型上补两件事：① 认领支持 **force**（`READY` 也能被重新认领，但「他人正在生成」仍拒绝，保持单写者）；② 编排层新增 `regenerate`，在同一个事务里完成「覆盖正文 + `version` 递增 + 作废依赖产物 + 清过期标记」。

**Tech Stack:** NestJS 10 · TypeORM 0.3.20（raw SQL 条件 UPDATE）· PostgreSQL 18.4 · Nuxt 3 + Vue 3 · ts-jest

**Spec:** `docs/specs/2026-09-16-ai-contract-and-dataflow-design.md`
- 第 7 节阶段 5：**过期 → 重新生成流（regenerate + `version` 递增 + 前端入口）**
- 第 9 节 D9：**覆盖式更新 + `version` 递增；历史由 `ai_generations.raw_response` 承载，不建历史表**
- 第 2.1 节原则 4：**失败局部可恢复**
**前置计划：** `docs/plans/2026-09-16-phase4-artifact-pipeline.md`（已完成）
**上一轮验证记录：** `docs/plans/2026-09-16-phase4-verification.md`（第四节「沙箱环境知识」务必先读）

---

## 本轮锁定的取舍（已与用户确认）

| # | 决策 | 取值 | 理由 |
|---|---|---|---|
| D13 | 重新生成成功后，过期的 `node.status` 怎么办 | **`OUTDATED_I` / `OUTDATED_II` → `ACTIVE`；`OUTDATED_III` 保持不变** | I/II 是「内容需刷新」，重生成即已修复；III 是「主题本身已淘汰」（如 jQuery），刷新正文不解决问题，应在 UI 明确提示删除节点 |
| D14 | 重新生成 coreText 时，依赖它的代码示例 / 练习题怎么办 | **作废并删除，按需重新生成**（任务置 `PENDING` + 清空内容行） | 二者是从**旧正文**派生的，保留必然与正文不一致；与既有「先删后插」一致；示例走预取、练习切 tab 生成 |
| D15 | 「重新生成」入口粒度 | **节点级一键 + 单产物各一个** | 节点过期要刷一遍时点一次；只想换练习题时单独点。后端同一套 force 认领支撑 |

> 为什么节点级一键 = 只 force coreText：`L3_CODE_EXAMPLES` / `L3_EXERCISES` 的输入就是 `coreText`，
> 正文换新后它们已按 D14 作废、会跟随消费时机重新生成。所以「一键」= 重生成正文 + 作废下游，
> **不是**连打三次 AI 调用（那是 D14 的第三选项，已被否）。

---

## Global Constraints

- **沙箱内 pnpm 需覆盖 `PNPM_HOME`**；`pnpm <script>` 在沙箱不可用（EPERM），一律直接调用 `node_modules/.bin/*`
- **bin 的位置**：根 `node_modules/.bin` 只有 `tsc`；`ts-node` / `jest` / `nest` / `typeorm` 在 `apps/api/node_modules/.bin`
- **禁止用 PowerShell `Get-Content`/`Set-Content` 读写回环改文本文件**（控制台 GBK，会写坏 UTF-8）。改文件一律用 edit / write 工具
- **`psql -c` 里禁止中文字面量**（会报 `无效的 "UTF8" 编码字节顺序`）；需要中文就写 UTF-8 的 `.sql` 文件走 `-f`
- **psql 不在 PATH**：`D:\Environment\PostgreSQL\18\bin\psql.exe`（`$env:PGPASSWORD` 从 `.env` 的 `DB_PASSWORD` 取）
- **改了 `packages/*/src` 必须重新构建 dist**（`tsc -p packages/<pkg>/tsconfig.json`）；本轮改 `packages/shared`（新增 `nodeStatus` 字段）→ 需 build
- **`@skill/*` 双解析路径**：`tsc` 走 `packages/*/src`（paths），jest/ts-node/nest 运行时走 `packages/*/dist`
- **单测不连库**（`new Service(...)` + mock）；Jest 必须 `--runInBand`
- 命令：`cd apps/api; node_modules\.bin\jest --runInBand`；`cd apps/api; node_modules\.bin\tsc --noEmit`；`cd apps/web; node_modules\.bin\nuxt typecheck`
- **每次改后端 DI/模块装配后必须 `nest start` 验启动**（单测与 tsc 覆盖不到启动期错误）
- **浏览器验证需要一次性权限升级**：`nuxt dev`（esbuild 子进程 EPERM）与 `playwright-cli`（daemon 目录在工作区外）都要 `sandbox_permissions: danger-full-access`
- **playwright 会话在两次命令之间会失效** → 「open → 登录 → 导航 → 交互 → 取值」必须串成**同一条命令**；`--raw eval` 输出最干净
- **Vue Flow 节点内的按钮对 Playwright 的 `click()` 不可达** → 用 `eval "...el.click()"` 或 `dispatchEvent('click')`
- **不要动用户正在跑的 dev server**：若 3001/3002 被占用（`EADDRINUSE`），另起 `API_PORT=3003` + 独立 web 实例验证
- 提交信息沿用仓库风格；**每个 Task 末尾单独提交，阶段末尾单独提交一次收尾**
- 真实 AI 端到端会消耗 token（`AI_PROVIDER=deepseek` 已配置真实 key）；**可只做 mock 验证时优先 mock**

---

## File Structure

### 新增

| 文件 | 职责 |
|---|---|
| `docs/plans/2026-09-16-phase5-verification.md` | 阶段 5 验证记录与执行偏差（T7） |

### 修改

| 文件 | 变更 |
|---|---|
| `packages/shared/src/interfaces/api.ts` | `NodeArtifactsResponse` 新增 `nodeStatus: NodeStatus`（抽屉头部据此显示过期，前端也据此就地更新图上节点） |
| `apps/api/src/modules/content/generation-task.service.ts` | `claim(nodeId, kind, force?)`：force 时允许从 `READY` 重新认领；他人正在生成（未陈旧）仍拒绝 |
| `apps/api/src/modules/content/generation-task.service.spec.ts` | 新增 force 认领的正/反例 |
| `apps/api/src/modules/content/artifact.service.ts` | 抽出 `generate(..., { force })`；新增 `regenerateArtifact` / `regenerateNode`；coreText 成功时 `version+1` + 作废依赖 + 清 `OUTDATED_I/II`；`getArtifacts` 返回 `nodeStatus` |
| `apps/api/src/modules/content/artifact.service.spec.ts` | 重新生成：版本递增 / 依赖作废 / 清过期（I/II 清、III 不清）/ 他人生成中不重复调 AI |
| `apps/api/src/modules/content/content.controller.ts` | `POST /nodes/:id/regenerate`、`POST /nodes/:id/artifacts/:kind/regenerate` |
| `apps/web/composables/useSkillTreePage.ts` | `regenerateNode` / `regenerateArtifact`（重新生成后同步 `nodeStatus` 到图上节点） |
| `apps/web/components/tree/L2ContentPanel.vue` | 抽屉头部：过期徽标 + 「重新生成」按钮（带确认弹窗）；向 L3Content 透传重新生成事件 |
| `apps/web/components/tree/L3Content.vue` | 代码演示 / 练习题两个区块各加「重新生成」（仅 `READY` 时显示） |
| `apps/web/components/tree/FlowNode.vue` | `OUTDATED_*` 节点显示**过期级别徽标**（今天只有配色/透明度，用户看不出「过期」） |
| `apps/web/pages/skills/[id]/tree.vue` | 接线 `@regenerate-node` / `@regenerate-artifact` |

---

## Task 1: `claim` 支持 force（重新生成的地基）

**Files:**
- Modify: `apps/api/src/modules/content/generation-task.service.ts`
- Modify: `apps/api/src/modules/content/generation-task.service.spec.ts`

**Interfaces:**
- Produces: `claim(nodeId: string, kind: ArtifactKind, force?: boolean): Promise<boolean>`

**语义（务必保持）**：
- `force=false`（默认）：只认领 `PENDING` / `FAILED` / 陈旧 `GENERATING`（与阶段 4 一致，幂等）
- `force=true`：额外允许从 `READY` 认领
- **两种情况都不允许抢占「新鲜的 `GENERATING`」** —— 否则并发重新生成会变成多写者

- [ ] **Step 1: 先写失败测试**

在 `generation-task.service.spec.ts` 追加：

```ts
it('force=true 时允许从 READY 重新认领（重新生成的地基）', async () => {
  dataSource.query.mockResolvedValue([{ id: 'task-1' }]);

  await expect(service.claim('n1', ArtifactKind.L3_CORE_TEXT, true)).resolves.toBe(true);

  const sql = dataSource.query.mock.calls[0][0] as string;
  const params = dataSource.query.mock.calls[0][1] as unknown[];
  expect(sql).toContain("and generation_tasks.status = 'READY'");
  expect(params).toContain(true);
});

it('force=false 时 SQL 不含 READY 分支，且参数为 false', async () => {
  dataSource.query.mockResolvedValue([]);

  await service.claim('n1', ArtifactKind.L3_CORE_TEXT);

  const sql = dataSource.query.mock.calls[0][0] as string;
  const params = dataSource.query.mock.calls[0][1] as unknown[];
  expect(sql).toContain("and generation_tasks.status = 'READY'");
  expect(params).toContain(false);
});

it('他人正在生成（新鲜 GENERATING）时 force 也抢不到', async () => {
  dataSource.query.mockResolvedValue([]);

  await expect(service.claim('n1', ArtifactKind.L3_EXERCISES, true)).resolves.toBe(false);
});
```

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/content/generation-task
```
Expected: FAIL —— `claim` 只接受 2 个参数

- [ ] **Step 2: 实现**

`claim` 的 SQL 末尾追加一个分支，并多传一个参数：

```sql
         where generation_tasks.status in ('PENDING', 'FAILED')
            or (generation_tasks.status = 'GENERATING'
                and generation_tasks.started_at < now() - ($3::int * interval '1 millisecond'))
            or ($4::boolean and generation_tasks.status = 'READY')
```

签名与调用：

```ts
async claim(nodeId: string, kind: ArtifactKind, force = false): Promise<boolean> {
  const rows: unknown[] = await this.dataSource.query(
    `...同上，末尾加 or ($4::boolean and generation_tasks.status = 'READY')`,
    [nodeId, kind, STALE_GENERATING_MS, force],
  );
  return rows.length > 0;
}
```

- [ ] **Step 3: 跑测试**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/content/generation-task
```
Expected: PASS（9 用例）

- [ ] **Step 4: 提交**

```powershell
git add apps/api/src/modules/content
git commit -m "✨ feat: generation_tasks 认领支持 force（READY 可重新认领，他人生成中仍拒绝）"
```

---

## Task 2: `regenerate` 编排（版本递增 + 依赖作废 + 清过期）

**Files:**
- Modify: `packages/shared/src/interfaces/api.ts`
- Modify: `apps/api/src/modules/content/artifact.service.ts`
- Modify: `apps/api/src/modules/content/artifact.service.spec.ts`

**Interfaces:**
- Consumes: `claim(..., force)`（Task 1）
- Produces:
  - `regenerateArtifact(nodeId, userId, kind): Promise<NodeArtifactsResponse>`
  - `regenerateNode(nodeId, userId): Promise<NodeArtifactsResponse>`（= 重新生成 coreText，自动作废下游）
  - `NodeArtifactsResponse.nodeStatus: NodeStatus`（新增字段，`getArtifacts` 也返回）

**编排规则**：
1. `force` 认领失败（他人正在生成）→ 返回当前状态，**不重复调 AI**
2. coreText 重新生成成功，在**同一个事务**里：`coreText` 覆盖写 + `version = existing.version + 1`
3. 同事务里**作废依赖产物**：删 `code_examples` / `exercises` 行，并把对应 `generation_tasks` 置 `PENDING`（`last_error=null`、`finished_at=null`，`attempts` 保留为累计值）
4. coreText 成功后，若 `node.status ∈ {OUTDATED_I, OUTDATED_II}` → 置 `ACTIVE`（**`OUTDATED_III` 不动**）
5. 失败路径不变：`markFailed` + 抛出；旧正文与依赖产物**保持原样**（没换新就是没换新）

- [ ] **Step 1: shared 加字段**

```ts
export interface NodeArtifactsResponse {
  /** 节点当前时效状态（抽屉据此显示过期提示；前端也用它就地更新图上节点） */
  nodeStatus: NodeStatus;
  coreText: ArtifactStatusView & { text: string | null };
  codeExamples: ArtifactStatusView & { items: ArtifactCodeExample[] };
  exercises: ArtifactStatusView & { items: ArtifactExercise[] };
}
```

```powershell
node_modules\.bin\tsc -p packages/shared/tsconfig.json
node_modules\.bin\tsc -p packages/shared/tsconfig.cjs.json
```

- [ ] **Step 2: 先写失败测试**

在 `artifact.service.spec.ts` 追加（沿用该文件既有的「内存假库」harness）：

```ts
it('重新生成 coreText：version 递增、依赖产物作废、OUTDATED_I 清回 ACTIVE', async () => {
  db.content = { id: 'c1', nodeId: 'n1', coreText: '旧正文'.padEnd(60, '。'), version: 3 };
  db.codeExamples = [{ title: 't', language: 'ts', code: 'c' }];
  db.exercises = [{ question: 'Q', options: ['a', 'b'], correctIndex: 0, explanation: 'E' }];
  nodeRepo.findOne.mockResolvedValue({ id: 'n1', treeId: 't1', parentId: 'l1', title: 'L2 主题', status: NodeStatus.OUTDATED_I });
  tasks.findForNode.mockResolvedValue([
    { artifactKind: ArtifactKind.L3_CODE_EXAMPLES, status: GenerationTaskStatus.READY, attempts: 1 },
    { artifactKind: ArtifactKind.L3_EXERCISES, status: GenerationTaskStatus.READY, attempts: 1 },
  ]);

  await service.regenerateNode('n1', 'u1');

  expect(db.content.version).toBe(4);
  expect(db.codeExamples).toEqual([]);
  expect(db.exercises).toEqual([]);
  expect(txCode.delete).toHaveBeenCalled();
  expect(txExercise.delete).toHaveBeenCalled();
  expect(nodeRepo.update).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'n1' }),
    { status: NodeStatus.ACTIVE },
  );
});

it('重新生成 coreText：OUTDATED_III 保持不清（主题已淘汰，刷新正文不解决问题）', async () => {
  db.content = { id: 'c1', nodeId: 'n1', coreText: '旧正文'.padEnd(60, '。'), version: 1 };
  nodeRepo.findOne.mockResolvedValue({ id: 'n1', treeId: 't1', parentId: 'l1', title: 'L2 主题', status: NodeStatus.OUTDATED_III });

  await service.regenerateNode('n1', 'u1');

  expect(nodeRepo.update).not.toHaveBeenCalled();
});

it('重新生成练习题不动正文版本、不作废示例', async () => {
  db.content = { id: 'c1', nodeId: 'n1', coreText: '已有核心内容', version: 7 };
  db.codeExamples = [{ title: 't', language: 'ts', code: 'c' }];
  db.exercises = [{ question: 'old', options: ['a', 'b'], correctIndex: 0, explanation: 'E' }];

  await service.regenerateArtifact('n1', 'u1', ArtifactKind.L3_EXERCISES);

  expect(db.content.version).toBe(7);
  expect(db.codeExamples).toHaveLength(1);
  expect(txCode.delete).not.toHaveBeenCalled();
  expect(txExercise.delete).toHaveBeenCalled();
});

it('他人正在生成时 force 也认领不到 → 不重复调 AI', async () => {
  tasks.claim.mockResolvedValue(false);

  await service.regenerateNode('n1', 'u1');

  expect(ai.generateL3CoreText).not.toHaveBeenCalled();
});
```

同时把既有用例里 `getArtifacts` 的断言补上 `nodeStatus`。

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/content/artifact
```
Expected: FAIL —— `regenerateNode` / `regenerateArtifact` 不存在

- [ ] **Step 3: 实现**

- 把现 `generateArtifact` 的主体抽成 `private async generate(nodeId, userId, kind, opts: { force: boolean })`，`claim(nodeId, kind, opts.force)`
- coreText 分支的事务内，`existing` 存在时：

```ts
await repo.update({ nodeId }, { coreText: result.coreText, version: existing.version + 1 });

// 依赖产物由旧正文派生，正文换新后必须作废（D14）
await manager.getRepository(CodeExample).delete({ nodeContentId: existing.id });
await manager.getRepository(Exercise).delete({ nodeContentId: existing.id });
await manager.getRepository(GenerationTask).update(
  { nodeId, artifactKind: In([ArtifactKind.L3_CODE_EXAMPLES, ArtifactKind.L3_EXERCISES]) },
  { status: GenerationTaskStatus.PENDING, lastError: null, finishedAt: null },
);
```

- coreText 成功、`markReady` 之后（仅 `opts.force` 时）：

```ts
// D13：I/II 视为「内容需刷新」，重生成即已修复；III 是主题淘汰，不自动清
await this.nodeRepo.update(
  { id: nodeId, status: In([NodeStatus.OUTDATED_I, NodeStatus.OUTDATED_II]) },
  { status: NodeStatus.ACTIVE },
);
```

- 新增公开方法：

```ts
/** 重新生成某一类产物（READY 也允许；依赖产物按 D14 作废） */
async regenerateArtifact(nodeId, userId, kind): Promise<NodeArtifactsResponse> {
  return this.generate(nodeId, userId, kind, { force: true });
}

/** 节点级「重新生成」：重生成正文 + 作废下游（下游按消费时机重新生成） */
async regenerateNode(nodeId, userId): Promise<NodeArtifactsResponse> {
  return this.generate(nodeId, userId, ArtifactKind.L3_CORE_TEXT, { force: true });
}
```

- `getArtifacts` 返回值加 `nodeStatus`（`loadContext` 已经取了 node；注意它与 `getArtifacts` 现在各自查一次节点 —— 若实现里 `getArtifacts` 直接复用了 `loadContext` 的 node 就传进来，否则补一次 `assertNodeOwner` 的返回）

> 实现提示：`generate` 已经通过 `loadContext` 拿到 `node`，可以让 `getArtifacts` 接受一个可选的已加载 node，避免多查一次。
> 保持「`getArtifacts` 自己也会做归属校验」这一不变量（单测里有断言）。

- [ ] **Step 4: 跑测试 + 类型检查**

```powershell
cd apps/api; node_modules\.bin\jest --runInBand src/modules/content
cd apps/api; node_modules\.bin\tsc --noEmit
```
Expected: 全绿 / exit 0

- [ ] **Step 5: 提交**

```powershell
git add packages/shared apps/api/src/modules/content
git commit -m "✨ feat: regenerate 编排（version 递增 + 依赖产物作废 + 过期标记清回 ACTIVE）"
```

---

## Task 3: 接口层 + 手工验证

**Files:**
- Modify: `apps/api/src/modules/content/content.controller.ts`

**Interfaces:**
- Produces:
  - `POST /api/nodes/:id/regenerate` → `NodeArtifactsResponse`（节点级一键）
  - `POST /api/nodes/:id/artifacts/:kind/regenerate` → `NodeArtifactsResponse`（单产物）

- [ ] **Step 1: 加两个端点**（沿用 `ParseEnumPipe` 校验 `kind`）

```ts
/** 节点级「重新生成」：重生成正文并作废下游产物（下游按消费时机重新生成） */
@UseGuards(JwtAuthGuard)
@Post('regenerate')
async regenerateNode(@Request() req, @Param('id') nodeId: string) {
  return this.artifactService.regenerateNode(nodeId, req.user.userId);
}

/** 单产物「重新生成」：已就绪的产物也允许换新 */
@UseGuards(JwtAuthGuard)
@Post('artifacts/:kind/regenerate')
async regenerateArtifact(
  @Request() req,
  @Param('id') nodeId: string,
  @Param('kind', new ParseEnumPipe(ArtifactKind)) kind: ArtifactKind,
) {
  return this.artifactService.regenerateArtifact(nodeId, req.user.userId, kind);
}
```

- [ ] **Step 2: 启动 + 路由核对**

```powershell
cd apps/api; node_modules\.bin\nest.cmd start   # 后台 job，注意到 EADDRINUSE 说明用户自己开着服务，改用 API_PORT=3003
```
Expected: 启动成功，路由表出现 `/api/nodes/:id/regenerate` 与 `/api/nodes/:id/artifacts/:kind/regenerate`

- [ ] **Step 3: mock provider 手工验证（真实库）**

用 `$env:AI_PROVIDER='mock'` + `API_PORT=3003` 起实例，脚本内完成：

| # | 请求 | 期望 |
|---|---|---|
| 1 | 建树 → 展开 → 生成 coreText + 示例 + 练习 | 三类 READY；`node_contents.version = 1` |
| 2 | `POST /nodes/:l2/regenerate` | 201；`coreText.status=READY`、`codeExamples=PENDING`、`exercises=PENDING`；`version = 2`；`code_examples`/`exercises` 行为 0 |
| 3 | 再 `POST /nodes/:l2/regenerate` | 201；`version = 3`（每次都递增） |
| 4 | `POST .../artifacts/L3_EXERCISES/regenerate` | 201；仅练习题换新，`version` 不变、示例不受影响 |
| 5 | `POST .../artifacts/NOT_A_KIND/regenerate` | 400 |
| 6 | 把节点状态置 `OUTDATED_I`（SQL）后 `POST /nodes/:l2/regenerate` | 响应 `nodeStatus=ACTIVE`，库中 `tree_nodes.status=ACTIVE` |
| 7 | 置 `OUTDATED_III` 后重新生成 | `nodeStatus` 仍为 `OUTDATED_III` |
| 8 | B 账号调用上述端点 | 403 |

> 第 6/7 项的 SQL 若含中文一律走 `.sql` 文件 + `psql -f`。

- [ ] **Step 4: 全量测试 + 提交**

```powershell
cd apps/api; node_modules\.bin\tsc --noEmit; node_modules\.bin\jest --runInBand
git add apps/api/src/modules/content
git commit -m "✨ feat: 重新生成接口（节点级一键 + 单产物），过期 I/II 自动清回 ACTIVE"
```

---

## Task 4: 前端状态层

**Files:**
- Modify: `apps/web/composables/useSkillTreePage.ts`

**Interfaces:**
- Produces:
  - `regenerateNode(nodeId): Promise<void>`
  - `regenerateArtifact(nodeId, kind): Promise<void>`

- [ ] **Step 1: 加两个方法**

要点：
1. 都调对应的 `POST` 端点，成功后 `storeArtifacts(nodeId, next)`
2. **把 `next.nodeStatus` 就地写回 `tree.value.nodes` 对应节点**，再 `rebuildGraph()`（否则图上仍显示过期徽标）
3. `regenerateNode` 会作废下游 → 顺带把 `exercises` 的本地状态也刷新（`storeArtifacts` 已经带上最新三类状态，无需额外处理）
4. 失败 → `toast.error`；`regenerateNode` 成功 → `toast.success('已重新生成')`
5. **不要**在 `regenerateArtifact` 里自动预取示例/练习；保持「用户点什么就生成什么」

- [ ] **Step 2: 类型检查**

```powershell
cd apps/web; node_modules\.bin\nuxt typecheck
```
Expected: exit 0（此时 UI 还没接线，仅状态层）

- [ ] **Step 3: 与 Task 5 合并提交**（单独提交会让前端无法编译/无用）

---

## Task 5: 前端 UI（过期可见 + 两个入口）

**Files:**
- Modify: `apps/web/components/tree/FlowNode.vue`
- Modify: `apps/web/components/tree/L2ContentPanel.vue`
- Modify: `apps/web/components/tree/L3Content.vue`
- Modify: `apps/web/pages/skills/[id]/tree.vue`

**Interfaces:**
- `L2ContentPanel` 新 emits：`regenerate-node(nodeId)`、`regenerate-artifact(nodeId, kind)`
- `L3Content` 新 emits：`regenerate(kind)`

- [ ] **Step 1: 图上过期徽标（否则用户根本不知道节点过期了）**

`FlowNode.vue`：`OUTDATED_*` 时在标题旁加一个徽标（沿用现有徽标样式，语义色 `--danger`/`--text-muted`），
文案 `过期 I` / `过期 II` / `过期 III`，并加 `title` 说明（如「内容可能过时，建议重新生成」/「主题已淘汰，建议删除」）。

- [ ] **Step 2: 抽屉头部的节点级入口**

`L2ContentPanel.vue`：
- 从 `artifacts.nodeStatus` 渲染过期提示条（`OUTDATED_I/II` → 「内容可能过时，建议重新生成」；`OUTDATED_III` → 「该主题已淘汰，建议删除节点」）
- 头部按钮：**「重新生成」**（`RefreshCw` 图标）→ 先 `useConfirm().confirm({ title: '重新生成学习内容？', message: '正文会重新生成，已有代码示例与练习题将被作废（之后按需重新生成）。', confirmText: '重新生成', confirmVariant: 'danger' })`，确认后 `emit('regenerate-node', nodeId)`
- `OUTDATED_III` 时按钮文案/提示改为引导删除（不提供重新生成）——**或**仍允许重新生成但提示「刷新正文不会改变主题已淘汰的事实」。**采用后者**：允许操作，但提示文案明确

- [ ] **Step 3: 每区块的单产物入口**

`L3Content.vue`：
- 代码演示、练习题两个区块顶部各加一个右侧小按钮「重新生成」（`text-[12px] text-muted hover:text-ink` + `RefreshCw`），**仅在该产物 `READY` 时显示**（`PENDING/GENERATING/FAILED` 已有各自提示与「重试」）
- 点击 `emit('regenerate', ArtifactKind.L3_CODE_EXAMPLES)` / `L3_EXERCISES`
- 概念区块不加（节点级按钮就是正文级）

- [ ] **Step 4: `tree.vue` 接线**

```vue
<TreeL2ContentPanel
  ...
  @regenerate-node="regenerateNode"
  @regenerate-artifact="regenerateArtifact"
/>
```
并在解构里加入 `regenerateNode` / `regenerateArtifact`。

- [ ] **Step 5: 类型检查 + 手工验证**

```powershell
cd apps/web; node_modules\.bin\nuxt typecheck
```
Expected: exit 0
浏览器（mock provider，独立实例）：
- 过期节点图上出现「过期 I/II/III」徽标
- 抽屉头部出现「重新生成」，点击弹确认框，确认后正文换新、示例/练习变为「正在生成…」→ 按需就绪
- 代码/练习区块的「重新生成」只刷新该区块
- `OUTDATED_I` 节点重新生成后徽标消失（状态回 ACTIVE）

- [ ] **Step 6: 提交（与 Task 4 合并）**

```powershell
git add apps/web
git commit -m "✨ feat: 前端重新生成入口（过期徽标 + 节点级一键 + 单产物）"
```

---

## Task 6: 真实 AI 端到端 + 浏览器验证

- [ ] **Step 1: 真实 AI 端到端**

| # | 验证项 | 期望 |
|---|---|---|
| 1 | 真实建树 → 展开 → 生成 coreText（v1） | READY，`node_contents.version=1` |
| 2 | 生成示例 + 练习 | 各 READY，行数 > 0 |
| 3 | `POST /nodes/:l2/regenerate` | **正文内容与 v1 不同**；`version=2`；示例/练习行被清空且任务 `PENDING` |
| 4 | 切练习题 → 按需生成 | 题目重新生成（基于 v2 正文） |
| 5 | `ai_generations` 审计 | `l3-core-text` 有两行（v1/v2），`parsed_ok=true` |
| 6 | 审计可追溯「哪一版」 | `request_hash` 不同（prompt 含正文前后变化）——如实记录能否区分，不能则记为遗留 |
| 7 | 越权 | B 账号 → 403 |
| 8 | 清理 | 删用户后领域表残留 0 |

- [ ] **Step 2: 浏览器验证**（mock + 独立实例；清单见 Task 5 Step 5）

- [ ] **Step 3: 全量回归**

```powershell
cd apps/api; node_modules\.bin\tsc --noEmit; node_modules\.bin\jest --runInBand; node_modules\.bin\ts-node scripts/verify-schema.ts
cd ../../packages/prompt-manager; ..\..\apps\api\node_modules\.bin\ts-node src/stages.selfcheck.ts
cd ../../apps/web; node_modules\.bin\nuxt typecheck
```

---

## Task 7: 阶段收尾

- [ ] **Step 1: 写 `docs/plans/2026-09-16-phase5-verification.md`**

结构参照 `docs/plans/2026-09-16-phase4-verification.md`：验证矩阵 / 真实端到端 / 浏览器实测 / 执行偏差 / 沙箱知识新增 / 遗留事项。

- [ ] **Step 2: 文档对齐**

- `AGENTS.md`：已知限制里删掉「过期 → 重新生成缺失」，补上新端点与 `NodeContent.version` 语义；测试策略补新用例
- `docs/系统架构设计.md`：8.9 节补两个 regenerate 端点；第 9 节 stage 表不变（无新 stage）；`TreeNode.status` 说明补「I/II 重新生成后清回 ACTIVE」

- [ ] **Step 3: 阶段提交**

```powershell
git add docs AGENTS.md
git commit -m "📃 docs: 阶段 5 验证记录 + 按实现对齐 AGENTS.md 与架构文档"
```

---

## Self-Review 结果

**规格覆盖**

| 设计条目 | 覆盖任务 |
|---|---|
| 阶段 5：regenerate | Task 1（force 认领）+ Task 2（编排）+ Task 3（接口） |
| 阶段 5：`version` 递增（D9） | Task 2（coreText 覆盖写时 +1） |
| 阶段 5：前端入口 | Task 4 + Task 5 |
| 2.1 原则 4「失败局部可恢复」 | Task 2（作废下游而非整体失败；失败时保持原样） |

**类型一致性核对**
- `claim(nodeId, kind, force?)` 在 Task 1 定义，Task 2 按此调用 ✓
- `NodeArtifactsResponse.nodeStatus` 在 Task 2 定义（shared），Task 3/4/5 均按此消费 ✓
- `regenerateNode` / `regenerateArtifact` 在 Task 2 定义，Task 3 控制器与 Task 4 composable 按此调用 ✓

**已知顺序约束**
1. Task 1 必须先于 Task 2（force 是前提）
2. Task 2 必须先于 Task 3/4/5（方法与前端的 DTO 字段）
3. **Task 4 与 Task 5 必须同一个提交**（只改状态层不接线会让前端功能悬空）
4. 改了 `packages/shared` 后**必须 build dist**，否则 apps/api 运行时读不到新字段

**风险与回退**

| 风险 | 应对 |
|---|---|
| 重新生成作废下游内容，用户可能觉得「丢东西」 | 节点级操作**有确认弹窗**且明确写出后果；单产物操作不作废其他区块 |
| 反复重新生成烧 token | 每次都是用户显式点击；`ai_generations` 可按 stage/时间统计；不做任何自动重生成 |
| `version` 语义只覆盖 coreText | 如实记录：示例/练习题是「先删后插」无版本号；若将来需要，再引入 artifact 级版本列（本轮不做） |
| 审计无法区分「同一节点的第几版正文」 | `request_hash` 由 prompt 派生，正文变化则 hash 变化，可间接区分；若要显式版本，需给 `ai_generations` 加列（本轮不做，记入遗留） |
| 用户可能想让 `OUTDATED_III` 也能清掉 | D13 已定：不清，但 UI 明确提示；若要支持，后续加手动状态编辑 |

---

## Execution Handoff

计划已保存到 `docs/plans/2026-09-16-phase5-outdated-regeneration.md`。两种执行方式：

**1. Subagent-Driven** —— 每个 Task 派全新 subagent，任务间两阶段评审。

**2. Inline Execution** —— 当前会话按批次执行，带检查点。

**建议 Inline**（与阶段 1–4 一致）：Task 之间有硬顺序依赖、共用同一个数据库与 `.env`，且需要真连库与浏览器验证，串行更省心。
