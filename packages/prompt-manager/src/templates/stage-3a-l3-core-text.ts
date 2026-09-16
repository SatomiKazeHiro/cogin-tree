import * as z from 'zod';
import { defineTemplate } from '../prompt-engine';

export interface L3CoreTextInput {
  skillTreeName: string;
  l1Title: string;
  l2Title: string;
}

export const l3CoreTextSchema = z.object({
  coreText: z
    .string()
    .min(50)
    .max(6000)
    .meta({ description: '核心学习内容，Markdown 排版，300-800 字' }),
});
export type L3CoreTextOutput = z.infer<typeof l3CoreTextSchema>;

/**
 * Stage 3a：L3 核心文本（从原 stage 3 拆出）。
 * 只负责「概念讲解」，不再顺带产出代码示例与练习题 —— 三者边界清晰、可独立失败与重试。
 */
export const stage3aL3CoreText = defineTemplate<L3CoreTextInput, L3CoreTextOutput>({
  version: '1.0.0',
  stage: 'l3-core-text',
  schema: l3CoreTextSchema,
  body: (input) => `
角色：你是一位资深的技术内容作者。
任务：为一个 L2 学习主题撰写核心学习内容。L3 代表"具体学什么"，是可直接学习的知识点。

输入：
- 技能方向：${input.skillTreeName}
- L1 节点：${input.l1Title}
- L2 节点：${input.l2Title}

要求：
1. 用中文撰写 300-800 字的核心学习内容，解释概念、用途、注意事项。
2. 必须使用 Markdown 格式排版，避免写成一整个长段落。
3. 使用二级标题（##）划分小节，例如：基本语法、使用场景、注意事项、常见误区等。
4. 使用列表（- 或 1.）展示并列点、步骤或示例。
5. 关键术语、函数名等使用行内代码或加粗突出。
6. 每个段落控制在 3-5 句话以内，段落之间留出空行。
7. 只讲概念与用法，不要展开完整代码实现，也不要出练习题（另有步骤负责）。
`,
});
