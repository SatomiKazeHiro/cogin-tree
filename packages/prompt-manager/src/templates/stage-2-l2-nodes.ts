import { defineTemplate } from '../prompt-engine';
import { outlineSchema, type OutlineOutput } from '../schemas/common';

export interface L2NodesInput {
  l1Title: string;
  l1Description: string;
  skillTreeName: string;
}

export const stage2L2Nodes = defineTemplate<L2NodesInput, OutlineOutput>({
  version: '2.0.0',
  stage: 'l2-nodes',
  schema: outlineSchema,
  body: (input) => `
角色：你是一位资深的技术学习路径规划师。
任务：为一个 L1 节点生成 L2（二级）学习主题。L2 代表"有什么内容"，是 L1 下的具体知识模块。

输入：
- 技能方向：${input.skillTreeName}
- L1 节点标题：${input.l1Title}
- L1 节点描述：${input.l1Description}

要求：
1. 输出 3-6 个 L2 节点，覆盖 L1 节点下的核心主题。
2. 每个节点包含 title（标题，5-20 字）和 description（一句话描述）。
3. 节点应具体、可学习，避免过于宏大或重复。
`,
});
