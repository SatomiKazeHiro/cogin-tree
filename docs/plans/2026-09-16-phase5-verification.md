# 计划 D（阶段 5：过期 → 重新生成流）验证记录与执行偏差

> **日期**：2026-09-25
> **分支**：`main`（阶段 5 全程在 `main` 上做，未另开分支）
> **依据计划**：`docs/plans/2026-09-16-phase5-outdated-regeneration.md`
> **依据设计**：`docs/specs/2026-09-16-ai-contract-and-dataflow-design.md`（第 7 节阶段 5、第 9 节 D9）
> **提交范围**：`f3ead1b`（计划）→ T1 `ad67b22`、T2 `c4d0783`、T3 `78427cf`、T4+T5 `5f3fc3f`

---

## 一、验证矩阵

| 层次 | 手段 | 结果 |
|---|---|---|
| 状态机单测 | `jest generation-task.service.spec.ts` | **9/9 通过**（新增 force 认领 3 条：READY 可抢 / 缺省 false / 他人生成中抢不到） |
| 编排单测 | `jest artifact.service.spec.ts` | **12/12 通过**（新增：版本递增+依赖作废+清 I、III 不清、单产物不动正文、force 也幂等） |
| 全量单测 | `jest --runInBand` | **16 suites / 91 tests 全绿**（阶段开始时 16 suites / 83 tests） |
| 类型检查 | `apps/api` `tsc --noEmit` | exit 0 |
| 前端类型检查 | `apps/web` `nuxt typecheck` | exit 0 |
| 应用启动（DI/路由） | `nest start` + 真实库 | 启动成功；路由表出现 `/api/nodes/:id/regenerate`、`/api/nodes/:id/artifacts/:kind/regenerate` |
| 结构断言 | `ts-node scripts/verify-schema.ts` | **SCHEMA OK**（24 项未回归；本轮**无迁移**） |
| 契约自检 | 三个 selfcheck | **SELFCHECK OK**（11 个 stage 未受影响） |
| 接口八项（mock） | 真实库 + `AI_PROVIDER=mock` | **8 / 8 通过**（见 2.1） |
| **真实 AI 端到端** | 真实 DeepSeek + 真实库 | **7 / 7 通过**（见 2.2） |
| **浏览器 UI 验证** | `nuxt dev` + playwright-cli（mock） | 徽标 / 提示 / 两个入口 / 确认框 / 实际换新全部实测（见 2.3） |
| 数据清理 | 删除全部验证用户 | 领域表残留 0（见 2.4） |

---

## 二、端到端实测结果

### 2.1 接口八项（mock provider，无 token 消耗）

| # | 请求 | 期望 | 实测 |
|---|---|---|---|
| 1 | 生成三类产物 | 各 READY | `version=1`、`code_examples=1`、`exercises=2` |
| 2 | `POST /nodes/:l2/regenerate` | 正文换新 + 依赖作废 | 201；`core=READY`、`codes=PENDING`、`ex=PENDING`；**`version=2`**；`code_examples=0`、`exercises=0` |
| 3 | 再 regenerate 一次 | 版本继续递增 | 201；**`version=3`** |
| 4 | 先补回示例，再 `POST .../artifacts/L3_EXERCISES/regenerate` | 只换这一类 | 201；示例仍 `READY`（1 条未动）、练习题换新；**`version` 仍为 3** |
| 5 | `POST .../artifacts/NOT_A_KIND/regenerate` | 400 | **400**（`ParseEnumPipe`） |
| 6 | 状态置 `OUTDATED_I` 后 regenerate | 清回 ACTIVE | 201；响应 `nodeStatus=ACTIVE`；库中 `tree_nodes.status=ACTIVE` |
| 7 | 状态置 `OUTDATED_III` 后 regenerate | 保持不变 | 201；`nodeStatus=OUTDATED_III` |
| 8 | B 账号调两个端点 | 403 | **403 / 403** |

### 2.2 真实 AI 端到端（7 项）

| # | 验证项 | 实测 |
|---|---|---|
| 1 | 真实生成 coreText v1 | 201；**936 字** |
| 2 | 真实生成示例 + 练习题 | 各 READY；示例 3 条、练习 6 条；`version=1` |
| 3 | `POST /nodes/:l2/regenerate`（v2） | 201；`version=2`；**正文与 v1 确实不同**（936 → 771 字）；`code_examples=0`、`exercises=0`，两者任务 `PENDING` |
| 4 | 切练习题 → 按需重新生成 | 201；6 道题（基于 v2 正文） |
| 5 | 审计行数 | `l3-core-text` 3 行（v1 成功 1 行 + v2「失败 1 + 重试成功 1」） |
| 6 | 审计能否区分版本 | **部分可以**：练习题基于 v1/v2 正文两次调用的 `request_hash` 不同（`703599c7…` vs `0969b691…`），证明依赖产物确实用了新正文；但 `l3-core-text` 自身两版的**首次尝试 hash 相同**（`bd7b0e93…`）—— 因为该 stage 的输入只有「技能方向 / L1 / L2 标题」，不含旧正文，**同一输入必然同一 hash**。要显式区分「第几版」需给 `ai_generations` 加列（本轮不做，见遗留事项） |
| 7 | 越权 | B 账号 → **403** |

顺带观测到契约层重试在真实模型上生效：v2 的第一次返回缺 `coreText` 字段（`schema_mismatch`），服务带 issues 以 0.3 温度重试后通过；两次审计行的 `request_hash` 不同（重试提示词追加了反馈段）——**这正是 hash 能反映「输入变化」的正面例子**。

### 2.3 浏览器 UI 验证（mock provider + 独立实例）

夹具：真实库中把某 L2 置为 `OUTDATED_II`，三类产物均已就绪。

| # | 场景 | 实测 |
|---|---|---|
| 1 | 图上过期徽标 | 该节点显示 **「过期 II」**（此前过期只有配色/透明度，用户看不出） |
| 2 | 打开抽屉 | 头部出现 **「重新生成」**；下方提示 **「AI 分析提示：该主题内容明显过时，建议重新生成。」** |
| 3 | 切「代码演示」tab | 出现 **「重新生成示例」** |
| 4 | 切「练习题」tab | 出现 **「重新生成练习」** |
| 5 | 点头部「重新生成」 | 弹确认框：「重新生成学习内容？/ 正文将重新生成；已有代码示例与练习题由旧正文派生，会被作废并随后按需重新生成。/ 取消 / 重新生成」 |
| 6 | 确认 | 过期提示消失；图上徽标消失；「代码演示」tab 消失（示例已作废）；练习题区显示 **「正在出题…」** 并按需生成 |
| 7 | 数据库旁证 | `tree_nodes.status=ACTIVE`（从 `OUTDATED_II` 清回）、`version=2`、`code_examples=0`、`exercises=0`；`generation_tasks`：coreText `READY/attempts=2`、示例 `PENDING`、练习 `PENDING` |

> 附带收获：阶段 4 验证时**没能截到**的 `ArtifactStateHint` 的 PENDING 文案（「正在出题…」），这次在第 6 步直接目击到了。

### 2.4 清理

删除验证用户后：`users=0`（除用户自己的账号外无残留）、`generation_tasks` 随节点级联删除、`ai_generations` 留存（外键 SET NULL）。

---

## 三、执行偏差记录

### 3.1 计划片段有缺陷（实现时修正）

| # | 计划写法 | 问题 | 实际处理 |
|---|---|---|---|
| 1 | T2 测试里用 `nodeRepo.findOne.mockResolvedValue({... status: OUTDATED_I })` 造过期节点 | **指错了 repo**：`nodeRepo` 在 `ArtifactService` 里用于查 L1 父节点；节点本身来自 `treeAccess.assertNodeOwner` | 改用 `treeAccess.assertNodeOwner` 返回带 `status` 的节点，并在 harness 里引入 `nodeRow`（假库语义：`nodeRepo.update` 真的改它），这样「重新生成后 `view.nodeStatus` 变成 ACTIVE」才可断言 |
| 2 | T2 计划里的 harness 未包含 `GenerationTask` 的事务 repo | 事务里要作废依赖任务（`manager.getRepository(GenerationTask)`），既有 harness 对未知实体会 `throw` | harness 增加 `txTask` stub 并放行 `GenerationTask` |
| 3 | 未预告 `finishedAt: null` 会触发类型错误 | TypeORM 的 `QueryDeepPartialEntity` 不接受 `null`，除非属性类型含 `null`；而直接写 `Date \| null` 会让 `design:type` 退化成 Object（阶段 1 的坑） | 给 `finished_at` 补**显式** `type: 'timestamp'` 后再声明 `Date \| null`（与阶段 4 处理 `model` 同一手法），**无需迁移**（列类型未变） |
| 4 | T2 未提到既有用例需同步 | `generateArtifact` 现在调用 `claim(..., false)`，原断言 `toHaveBeenCalledWith('n1', KIND)` 因多了一个实参而失败 | 断言补 `false`（更精确） |

### 3.2 计划未列但必须做的事

| # | 事项 | 原因 |
|---|---|---|
| 5 | `getArtifacts` 需要返回 `nodeStatus`，且实现里要复用 `assertNodeOwner` 的返回值 | 既满足「抽屉显示过期」（D13 的 UI 侧），又让前端在重新生成后**就地**更新图上节点（不必重拉整棵树）；单测里保留了「`getArtifacts` 自己做归属校验」这条不变量 |

### 3.3 实现中自查修正的一处写法

`L2ContentPanel` 的「重新生成」按钮最初用 `ref + setTimeout` 假装 loading，1.2s 后自行复位 —— 那是**假状态**。
改为从产物状态机派生 `coreBusy`（`coreText.status` 为 `PENDING`/`GENERATING` 时禁用并转圈），状态、按钮、提示三者同源。

---

## 四、沙箱环境知识（新增）

1. **`psql -c` 里出现中文字面量必报 `无效的 "UTF8" 编码字节顺序`**（本轮又踩了一次）：
   本阶段所有夹具 SQL 都改成**纯 ASCII**（状态值 `OUTDATED_I` 等本来就是 ASCII），彻底绕开该问题，比写 `.sql` 文件更省事。
2. **playwright 的 `--raw eval` 是唯一稳定的取值方式**：普通 `eval` 的输出会与代码围栏、更新提示混在一起，`Select-Object -Last 1` 常常取到 ``` 那一行；`--raw` 只返回结果值本身。
3. **抽屉内的分区按钮只在对应 tab 激活时存在**（`v-if="activeTab === 'code'"`）——验证分区入口前必须先切换 tab，否则会误判为「按钮没渲染」。
4. **用户可能同时开着自己的 dev server**：本轮 3002 被占用时改为 `API_PORT=3003` + 独立 web 实例（`NUXT_PUBLIC_API_BASE_URL` 指向 3003），完全不打扰用户会话；验证夹具共用同一个数据库，用完按**精确 email/user id** 删除。

---

## 五、遗留事项

| 事项 | 说明 |
|---|---|
| 审计无法显式区分「同一节点的第几版正文」 | `l3-core-text` 的输入不含旧正文 ⇒ 同输入同 hash。要做版本追溯需给 `ai_generations` 加列（如 `node_content_version`）或把旧正文摘要纳入输入；本轮不做 |
| 代码示例 / 练习题没有版本号 | 只有 `node_contents.version`；二者是「先删后插」，`attempts` 只记认领次数。若将来需要，再引入 artifact 级版本列 |
| `OUTDATED_III` 仍无「删除节点」的引导按钮 | 本轮只在抽屉与节点徽标里**文案提示**「建议删除」，删除仍需用户去节点菜单操作 |
| 节点状态仍无法手动改回 | `UpdateNodeDto` 只允许 title/description；本轮通过「重新生成成功即清 I/II」覆盖了主要场景，手动状态编辑仍缺 |
| 反复重新生成的成本 | 每次都是用户显式点击且**有确认框**；`ai_generations` 可按 stage/时间统计。无任何自动重生成 |
| 阶段 4 遗留项未变 | interview 内存 Map 去重、`*.selfcheck.ts` 进 dist、`shared/index.ts` 手工同步、`tree_nodes.level` 的 L3、`skill_trees.keywords` 只写不读、ANTHROPIC 未接入、无 Docker/CI |
