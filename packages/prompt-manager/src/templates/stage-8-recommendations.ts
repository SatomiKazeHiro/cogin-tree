import * as z from 'zod';
import { defineTemplate } from '../prompt-engine';

export interface RecommendationInput {
  portrait: {
    summary?: string;
    identityTags?: string[];
    interestTags?: string[];
    goalTags?: string[];
    learningStyle?: string;
  };
  learningSkills: { name: string; type: string; description?: string }[];
  oldRecommendations: { title: string; reason: string }[];
}

export const recommendationsSchema = z.object({
  recommendations: z
    .array(
      z.object({
        title: z.string().min(1).max(60).meta({ description: '学习方向名称' }),
        description: z.string().min(1).max(200).meta({ description: '一句话描述' }),
        reason: z
          .string()
          .min(1)
          .max(300)
          .meta({ description: '推荐理由，需指明匹配了用户肖像的哪个维度' }),
        matchTags: z
          .array(z.string().min(1).max(20))
          .max(5)
          .meta({ description: '匹配维度标签，只能从 身份/兴趣/目标/学习风格 中选取' }),
        suggestedMode: z
          .enum(['ENTRY', 'EXPERT', 'INTERVIEW'])
          .meta({ description: '建议从哪个模式开始' }),
        keywords: z
          .array(z.string().min(1).max(30))
          .max(10)
          .meta({ description: '该方向下值得优先学习的知识点或子方向' }),
      }),
    )
    .min(1)
    .max(10)
    .meta({ description: '推荐列表，最多 10 条' }),
});
export type RecommendationsOutput = z.infer<typeof recommendationsSchema>;

export const stage8Recommendations = defineTemplate<RecommendationInput, RecommendationsOutput>({
  version: '2.0.0',
  stage: 'recommendations',
  schema: recommendationsSchema,
  body: (input) => `
角色：你是一位个性化学习路径规划师。
任务：基于用户的肖像和当前学习情况，推荐最适合的学习方向。

输入：
- 用户肖像摘要：${input.portrait.summary || '无'}
- 身份标签：${(input.portrait.identityTags || []).join('，') || '无'}
- 兴趣标签：${(input.portrait.interestTags || []).join('，') || '无'}
- 目标标签：${(input.portrait.goalTags || []).join('，') || '无'}
- 学习风格：${input.portrait.learningStyle || '无'}

- 正在学习的技能：
${input.learningSkills.length ? input.learningSkills.map((s) => `  - ${s.name}（${s.type}）${s.description ? '：' + s.description : ''}`).join('\n') : '  无'}

- 上周推荐：
${input.oldRecommendations.length ? input.oldRecommendations.map((r) => `  - ${r.title}：${r.reason}`).join('\n') : '  无'}

要求：
1. 输出 6-10 个推荐方向，最多不超过 10 个；宁缺勿滥，不要为凑数而堆砌。
2. 综合考量用户肖像、已有学习技能、旧推荐。
3. 排除用户已经在学的方向。
4. 从旧推荐中保留仍适合的，补充新的。
5. 每个推荐需附具体理由（结合用户肖像的哪个维度）。
6. 方向要有层次：基础与进阶搭配。
7. matchTags 只能从「身份」「兴趣」「目标」「学习风格」中选取相关标签。
8. suggestedMode 只能是 ENTRY、EXPERT 或 INTERVIEW 之一。
9. 每个推荐需给出 3-6 个关键词（keywords），代表该方向下值得优先学习的知识点或子方向，供用户后续编辑。
`,
});
