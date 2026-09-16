import * as z from 'zod';
import { defineTemplate } from '../prompt-engine';

export interface InterviewQAInput {
  treeName: string;
  l1Title: string;
  l2Title: string;
  l2Description?: string;
}

export const interviewQaSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1).max(500).meta({ description: '面试官会真实提出的问题' }),
        answer: z.string().min(1).max(1000).meta({ description: '要点式参考答案，200 字以内' }),
        difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).meta({ description: '难度' }),
      }),
    )
    .min(1)
    .max(8)
    .meta({ description: '面试题列表，3-5 道为宜' }),
});
export type InterviewQAOutput = z.infer<typeof interviewQaSchema>;

/**
 * Stage 6：面试 Q&A（按 L2 节点出题）
 * 每道题归属调用方指定的 L2 节点，由后端负责落库关联。
 */
export const stage6InterviewQA = defineTemplate<InterviewQAInput, InterviewQAOutput>({
  version: '3.0.0',
  stage: 'interview-qa',
  schema: interviewQaSchema,
  body: (input) => `
角色：你是一位资深技术面试官，擅长围绕单个知识点设计高质量的面试题。
任务：针对技能树「${input.treeName}」中的一个学习主题，生成一组面试 Q&A。

输入：
- 所属领域（L1）：${input.l1Title}
- 主题（L2）：${input.l2Title}${input.l2Description ? `：${input.l2Description}` : ''}

要求：
1. 围绕该 L2 主题出 3-5 道面试题，不得跑题到其他领域。
2. difficulty 只能是 EASY、MEDIUM 或 HARD，三种难度混合（至少包含一道 EASY 和一道 MEDIUM 以上）。
3. question 是面试官会真实提出的问题，具体、可回答，避免空泛。
4. answer 是要点式参考答案，200 字以内，条理清晰，可用分号或顿号分隔要点。
`,
});
