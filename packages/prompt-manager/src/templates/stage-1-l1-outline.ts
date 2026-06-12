import { PromptTemplate, extractJson } from '../prompt-engine';

interface L1OutlineInput {
  title: string;
  description?: string;
  type: string;
}

interface L1OutlineOutput {
  nodes: { title: string; description: string }[];
}

export const stage1L1Outline: PromptTemplate<L1OutlineInput, L1OutlineOutput> = {
  version: '1.0.0',
  build: (input) => `
角色：你是一位资深的技术学习路径规划师。
任务：为一个技能方向生成 L1（一级）学习大纲。L1 代表"学什么"，是最高层级的知识领域划分。

输入：
- 技能方向名称：${input.title}
- 描述：${input.description || '无'}
- 模式：${input.type}

要求：
1. 输出 4-8 个 L1 节点，覆盖该技能方向的核心领域。
2. 每个节点包含 title（标题，5-15 字）和 description（一句话描述）。
3. 节点之间应逻辑清晰、互不重叠、循序渐进。
4. 输出必须是合法 JSON，不要包含 Markdown 代码块外的任何内容。

输出格式：
{
  "nodes": [
    { "title": "...", "description": "..." },
    ...
  ]
}
`,
  parse: extractJson,
};
