import * as z from 'zod';
import { defineTemplate } from '../prompt-engine';

export interface KnowledgePointsInput {
  title: string;
  description?: string;
  type: string;
  keywords?: string;
}

export const knowledgePointsSchema = z.object({
  points: z
    .array(z.string().min(1).max(60))
    .min(1)
    .max(30)
    .meta({ description: '候选知识点列表' }),
});
export type KnowledgePointsOutput = z.infer<typeof knowledgePointsSchema>;

export const stage0KnowledgePoints = defineTemplate<
  KnowledgePointsInput,
  KnowledgePointsOutput
>({
  version: '2.0.0',
  stage: 'knowledge-points',
  schema: knowledgePointsSchema,
  body: (input) => `
角色：你是一位资深的技术学习路径规划师。
任务：为一个技能方向拆解出具体、可学习的知识点清单。这些知识点将交给用户勾选，再被你归纳成 L1 学习大纲。

输入：
- 技能方向名称：${input.title}
- 描述：${input.description || '无'}
- 模式：${input.type === 'EXPERT' ? '进阶' : '入门'}
- 用户补充关键词：${input.keywords || '无'}

要求：
1. 输出 12-20 个知识点，覆盖该技能方向的核心子领域。
2. 每个知识点应是一个具体、独立的学习单元，字数控制在 4-12 字。
3. 粒度适中：既不要过宏观（如"基础"），也不要过细节（如某个具体函数的用法）。
4. 若用户提供了补充关键词，优先包含相关知识点，并保证其排序靠前。
5. 知识点之间允许有依赖关系，但不要重复。
`,
});
