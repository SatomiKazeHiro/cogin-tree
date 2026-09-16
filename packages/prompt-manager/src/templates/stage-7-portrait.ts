import * as z from 'zod';
import { defineTemplate } from '../prompt-engine';

export interface PortraitInput {
  identityAnswers: string[];
  interestAnswers: string[];
  goalAnswers: string[];
  backgroundAnswers: string[];
}

export const portraitSchema = z.object({
  summary: z.string().min(1).max(200).meta({ description: '50 字以内的用户状态概括' }),
  identityTags: z
    .array(z.string().min(1).max(30))
    .min(1)
    .max(10)
    .meta({ description: '身份标签，3-5 个' }),
  interestTags: z
    .array(z.string().min(1).max(30))
    .min(1)
    .max(10)
    .meta({ description: '兴趣标签，3-5 个' }),
  goalTags: z
    .array(z.string().min(1).max(30))
    .min(1)
    .max(10)
    .meta({ description: '目标标签，2-4 个' }),
  learningStyle: z
    .string()
    .min(1)
    .max(50)
    .meta({ description: '学习偏好标签，如 hands-on / theory-first / video / reading' }),
});
export type PortraitOutput = z.infer<typeof portraitSchema>;

export const stage7Portrait = defineTemplate<PortraitInput, PortraitOutput>({
  version: '2.0.0',
  stage: 'portrait',
  schema: portraitSchema,
  body: (input) => `
角色：你是一位用户画像分析师。
任务：基于用户的问卷调查答案，生成用户肖像摘要。

输入：
- 身份信息：${input.identityAnswers.join('；')}
- 兴趣偏好：${input.interestAnswers.join('；')}
- 学习目标：${input.goalAnswers.join('；')}
- 背景信息：${input.backgroundAnswers.join('；')}

输出要求：
1. summary：一段自然语言描述（50 字以内），概括用户当前状态。
2. identityTags：3-5 个身份标签。
3. interestTags：3-5 个兴趣标签。
4. goalTags：2-4 个目标标签。
5. learningStyle：学习偏好标签（如 hands-on、theory-first、video、reading）。
`,
});
