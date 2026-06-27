# Vue Flow 技能详情页二期（剩余工作）

## 背景

一期已实现：
- Vue Flow 基础展示（root → L1 → L2）
- L2 作为叶节点，内容在右侧面板展示
- 节点状态可视化（ACTIVE / OUTDATED_I / OUTDATED_II / OUTDATED_III）
- L1「初始化」、L2「分析」/「详情」、右侧面板 Tabs（概念 / 代码演示 / 选择题）

二期目标：补齐「分析」能力，让 root/L1/L2 都能触发 AI 分析，产生新增/过期建议，并支持用户采纳。

## 需求

### 1. root 节点「分析」按钮
- root 节点显示「分析」按钮
- 点击后调用分析接口，基于整棵树的 L1/L2 结构判断：
  - 是否有遗漏的 L1 方向（新增建议）
  - 哪些 L1 已经过时（过期建议）
- 分析结果在右侧面板展示建议列表（新增 / 过期）
- 用户可以采纳建议：新增 L1、标记 L1 为某个过期等级

### 2. L1 节点「分析」按钮（已有「初始化」的 L1 才显示）
- 对已展开（有 L2 子节点）的 L1 显示「分析」按钮
- 基于该 L1 下的所有 L2 内容判断：
  - 是否需要新增 L2 子节点
  - 哪些 L2 已经过时
- 右侧面板展示建议列表，支持采纳

### 3. L2 节点过期分析
- L2 节点当前只有「分析」（生成内容）和「详情」
- 二期为 L2 增加「过期检查」入口：
  - 在 L2 卡片上增加更多操作（如右键菜单或下拉）
  - 点击「检查是否过时」触发 CHECK_EXPIRE 分析
  - 结果可标记该 L2 为 OUTDATED_I / II / III

### 4. 右侧面板：建议列表
- 新增 `AnalysisPanel.vue` 组件
- 显示两类建议：
  - **新增（ADD）**：title、description、keyPoints
  - **过期（EXPIRE）**：title、description、expireLevel
- 每个建议有「采纳」和「忽略」按钮
- 采纳后：
  - ADD：创建对应节点
  - EXPIRE：更新目标节点 status

### 5. 后端分析模块
- 复用或新建 `analysis` module
- 新增/复用 `AnalysisJob` / `SuggestedChange` 实体
- 新增接口：
  - `POST /api/nodes/:id/analyze` — 触发分析
  - `GET /api/analysis/:jobId/results` — 获取建议列表
  - `POST /api/analysis/:jobId/apply` — 采纳建议
- 新增 Prompt 模板：
  - Stage 4：分析新增节点
  - Stage 5：分析过期节点
- 分析时读取子节点 keyPoints，不遍历完整内容

### 6. 前端状态更新
- 采纳建议后刷新 Vue Flow 图
- 节点 status 变化后重新渲染边框/徽章
- 分析中状态 loading

## 涉及文件（预估）

**后端**
- `apps/api/src/modules/analysis/` 新建或补全
- `packages/prompt-manager/src/templates/stage-4-discover-new.ts`
- `packages/prompt-manager/src/templates/stage-5-check-expire.ts`
- `packages/prompt-manager/src/prompt-manager.ts` 注册 stage 4/5
- `apps/api/src/modules/skill-tree/entities/tree-node.entity.ts` 已支持 status

**前端**
- `apps/web/components/tree/FlowNode.vue` 增加分析按钮/菜单
- `apps/web/components/tree/AnalysisPanel.vue` 新增
- `apps/web/components/tree/VueFlowGraph.vue` 转发分析事件
- `apps/web/pages/skills/[id]/tree.vue` 处理分析逻辑、右侧面板切换

## 优先级

1. 后端分析接口 + Stage 4/5 Prompt
2. root 节点分析
3. L1 节点分析
4. L2 过期检查
5. 右侧面板建议列表 + 采纳

## 备注

- 一期已移除 settings 页的 AI Provider 配置，分析功能仍走 `.env` 中的 AI 配置。
- 一期已完成 L2 内容生成，二期不要把 L2 的「内容分析」和「过期分析」混淆。
