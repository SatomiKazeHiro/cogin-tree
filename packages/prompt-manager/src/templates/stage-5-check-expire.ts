import * as z from 'zod';
import { defineTemplate } from '../prompt-engine';

export interface CheckExpireInput {
  treeName: string;
  treeType?: string;
  nodes: { level: number; title: string; description?: string; parentTitle?: string }[];
  /** 已提出过但尚未处理的建议标题，避免重复建议 */
  existingSuggestions?: string[];
}

export const checkExpireSchema = z.object({
  suggestions: z
    .array(
      z.object({
        nodeTitle: z
          .string()
          .min(1)
          .max(120)
          .meta({ description: '要标记过期的节点标题，必须与现有节点逐字一致' }),
        expireLevel: z
          .number()
          .int()
          .min(1)
          .max(3)
          .meta({ description: '过期等级：1 轻微 / 2 明显 / 3 严重（建议放弃）' }),
        reason: z.string().min(1).max(300).meta({ description: '判断过时的依据' }),
      }),
    )
    .max(20)
    .meta({ description: '建议标记过期的节点列表；没有可以是空数组' }),
});
export type CheckExpireOutput = z.infer<typeof checkExpireSchema>;

/**
 * Stage 5：过期分析
 * 检查技能树节点内容是否已过时，并给出过期等级。
 */
export const stage5CheckExpire = defineTemplate<CheckExpireInput, CheckExpireOutput>({
  version: '2.0.0',
  stage: 'check-expire',
  schema: checkExpireSchema,
  body: (input) => {
    const nodeList = input.nodes
      .map((n) => {
        const levelName = n.level === 1 ? 'L1' : n.level === 2 ? 'L2' : 'L3';
        const parent = n.parentTitle ? `（属于 L1「${n.parentTitle}」）` : '';
        const desc = n.description ? `：${n.description}` : '';
        return `- [${levelName}] ${n.title}${parent}${desc}`;
      })
      .join('\n');

    return `
角色：你是一位资深的技术观察者，长期跟踪各类技术栈的演进与淘汰。
任务：检查以下技能树的节点，判断哪些主题已经过时或正在快速过时。

输入：
- 技能树名称：${input.treeName}
- 现有节点：
${nodeList || '（暂无节点）'}
${input.existingSuggestions?.length ? `\n以下节点已经被标记过过期建议但尚未处理，不要重复提出：\n${input.existingSuggestions.map((t) => `- ${t}`).join('\n')}\n` : ''}
过期等级定义：
- 1（轻微）：内容主体仍可用，但部分细节（版本、API、工具链）已有更新；
- 2（明显）：最佳实践已更替，继续按旧方式学习会走弯路；
- 3（严重）：技术已被官方废弃、停止维护或被业界普遍淘汰。

要求：
1. nodeTitle 必须与上方现有节点标题逐字一致，否则视为无效建议。
2. 每条建议给出 expireLevel（1/2/3）与 reason（一句话说明过时的依据，如官方公告、版本演进）。
3. 只列出确实过时的节点；没有则返回空数组，不要硬凑。
`;
  },
});
