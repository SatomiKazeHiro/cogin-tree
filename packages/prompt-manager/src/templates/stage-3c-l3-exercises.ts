import * as z from 'zod';
import { defineTemplate } from '../prompt-engine';
import { exerciseSchema } from '../schemas/common';

export interface L3ExercisesInput {
  skillTreeName: string;
  l1Title: string;
  l2Title: string;
  /** 已生成的核心内容，作为出题依据 */
  coreText: string;
}

export const l3ExercisesSchema = z.object({
  exercises: z.array(exerciseSchema).min(1).max(6).meta({ description: '单选题，4-6 道' }),
});
export type L3ExercisesOutput = z.infer<typeof l3ExercisesSchema>;

/**
 * Stage 3c：L3 练习题（从原 stage 3 拆出）。
 * 出题依据是 coreText，避免「题目考了没讲过的内容」。
 */
export const stage3cL3Exercises = defineTemplate<L3ExercisesInput, L3ExercisesOutput>({
  version: '1.0.0',
  stage: 'l3-exercises',
  schema: l3ExercisesSchema,
  // JSON Schema 无法表达「correctIndex 必须落在 options 下标范围内」，故走 invariants
  invariants: (v) =>
    v.exercises
      .map((ex, i) =>
        ex.correctIndex >= ex.options.length
          ? `exercises[${i}].correctIndex=${ex.correctIndex} 超出 options 下标范围(0..${ex.options.length - 1})`
          : null,
      )
      .filter((m): m is string => !!m),
  body: (input) => `
角色：你是一位资深的技术题库设计师。
任务：基于下面这个学习主题的核心内容，设计 4-6 道单选题，用于检验掌握程度。

输入：
- 技能方向：${input.skillTreeName}
- L1 节点：${input.l1Title}
- L2 节点：${input.l2Title}
- 核心内容：
${input.coreText}

要求：
1. 出 4-6 道单选题，每题 4 个选项，correctIndex 必须落在 options 的下标范围内。
2. 题目只能考察上面核心内容里讲过的知识，不要超纲。
3. 覆盖不同层次：概念辨析、使用场景、常见误区。
4. explanation 要说明为什么正确、以及常见错误选项错在哪。
`,
});
