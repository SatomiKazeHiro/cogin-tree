import * as z from 'zod';
import { defineTemplate } from '../prompt-engine';
import { codeExampleSchema } from '../schemas/common';

export interface L3CodeExamplesInput {
  skillTreeName: string;
  l1Title: string;
  l2Title: string;
  /** 已生成的核心内容，作为上下文保证示例与讲解一致 */
  coreText: string;
}

export const l3CodeExamplesSchema = z.object({
  codeExamples: z
    .array(codeExampleSchema)
    .max(3)
    .meta({ description: '代码示例；纯概念主题可为空数组' }),
});
export type L3CodeExamplesOutput = z.infer<typeof l3CodeExamplesSchema>;

/**
 * Stage 3b：L3 代码示例（从原 stage 3 拆出）。
 * 输入带 coreText，确保示例与核心讲解一致（这是拆分后仍保持内容连贯的关键）。
 */
export const stage3bL3CodeExamples = defineTemplate<L3CodeExamplesInput, L3CodeExamplesOutput>({
  version: '1.0.0',
  stage: 'l3-code-examples',
  schema: l3CodeExamplesSchema,
  body: (input) => `
角色：你是一位资深的技术内容作者，擅长编写可运行的示例代码。
任务：为下面这个学习主题提供 1-3 个可运行的代码示例。

输入：
- 技能方向：${input.skillTreeName}
- L1 节点：${input.l1Title}
- L2 节点：${input.l2Title}
- 已撰写的核心内容：
${input.coreText}

要求：
1. 提供 1-3 个与核心内容直接相关的代码示例，每个含 title、language、code。
2. code 要完整可运行或为核心片段，并带关键注释。
3. 示例必须紧扣上面的核心内容，不要引入未讲解的概念。
4. 如果该主题是纯概念性、不需要代码的，返回空数组。
`,
});
