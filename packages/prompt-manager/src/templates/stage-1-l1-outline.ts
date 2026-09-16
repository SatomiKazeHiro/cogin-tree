import { defineTemplate } from '../prompt-engine';
import { outlineSchema, type OutlineOutput } from '../schemas/common';

export interface L1OutlineInput {
  title: string;
  description?: string;
  type: string;
  selectedPoints?: string[];
}

export const stage1L1Outline = defineTemplate<L1OutlineInput, OutlineOutput>({
  version: '2.0.0',
  stage: 'l1-outline',
  schema: outlineSchema,
  body: (input) => {
    const pointsText = input.selectedPoints?.length
      ? `用户已勾选的知识点：\n${input.selectedPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n`
      : '';
    const modeText =
      input.type === 'EXPERT' ? '进阶' : input.type === 'INTERVIEW' ? '面试' : '入门';
    const modeHint =
      input.type === 'INTERVIEW'
        ? '\n4. 当前为面试模式：大纲应面向面试高频考点组织，侧重常被追问的核心概念、原理对比与实战经验。'
        : '';

    return `
角色：你是一位资深的技术学习路径规划师。
任务：为一个技能方向生成 L1（一级）学习大纲。L1 代表"学什么"，是最高层级的知识领域划分。

输入：
- 技能方向名称：${input.title}
- 描述：${input.description || '无'}
- 模式：${modeText}
${pointsText}
要求：
1. 输出 4-8 个 L1 节点，覆盖该技能方向的核心领域。
2. ${input.selectedPoints?.length ? '每个 L1 节点应基于用户勾选的知识点进行归纳分组，可以一个 L1 涵盖多个相关知识点。' : '每个节点包含 title（标题，5-15 字）和 description（一句话描述）。'}
3. 节点之间应逻辑清晰、互不重叠、循序渐进。${modeHint}
`;
  },
});
