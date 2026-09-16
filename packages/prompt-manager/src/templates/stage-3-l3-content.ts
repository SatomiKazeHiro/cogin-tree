import * as z from 'zod';
import { defineTemplate } from '../prompt-engine';
import { codeExampleSchema, exerciseSchema } from '../schemas/common';

export interface L3ContentInput {
  l1Title: string;
  l2Title: string;
  skillTreeName: string;
}

export const l3ContentSchema = z.object({
  coreText: z
    .string()
    .min(50)
    .max(6000)
    .meta({ description: '核心学习内容，Markdown 排版，300-800 字' }),
  codeExamples: z
    .array(codeExampleSchema)
    .max(3)
    .meta({ description: '代码示例；纯概念主题可为空数组' }),
  exercises: z.array(exerciseSchema).min(1).max(6).meta({ description: '单选题，4-6 道' }),
});
export type L3ContentOutput = z.infer<typeof l3ContentSchema>;

export const stage3L3Content = defineTemplate<L3ContentInput, L3ContentOutput>({
  version: '2.0.0',
  stage: 'l3-content',
  schema: l3ContentSchema,
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
角色：你是一位资深的技术内容作者和题库设计师。
任务：为一个 L2 节点生成 L3（三级）学习内容、可运行代码示例与练习题。L3 代表"具体学什么"，是可直接学习的知识点。

输入：
- 技能方向：${input.skillTreeName}
- L1 节点：${input.l1Title}
- L2 节点：${input.l2Title}

要求：
1. coreText：用中文撰写 300-800 字的核心学习内容，解释概念、用途、注意事项。
   - 必须使用 Markdown 格式排版，避免写成一整个长段落。
   - 使用二级标题（##）划分小节，例如：基本语法、使用场景、注意事项、常见误区等。
   - 使用列表（- 或 1.）展示并列点、步骤或示例。
   - 关键术语、代码片段、函数名等使用行内代码或加粗突出。
   - 每个段落控制在 3-5 句话以内，段落之间留出空行。
2. codeExamples：提供 1-3 个与知识点直接相关的可运行代码示例。若主题是纯概念性、不需要代码的，可返回空数组。
3. exercises：提供 4-6 道单选题，每题 4 个选项；correctIndex 必须落在 options 的下标范围内。
4. 内容应准确、实用、适合自学者。
`,
});
