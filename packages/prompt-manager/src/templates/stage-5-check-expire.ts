import { PromptTemplate, extractJson } from '../prompt-engine';

export interface CheckExpireInput {
  treeName: string;
  treeType?: string;
  nodes: { level: number; title: string; description?: string; parentTitle?: string }[];
  /** 已提出过但尚未处理的建议标题，避免重复建议 */
  existingSuggestions?: string[];
}

export interface CheckExpireSuggestion {
  nodeTitle: string;
  expireLevel: 1 | 2 | 3;
  reason: string;
}

export interface CheckExpireOutput {
  suggestions: CheckExpireSuggestion[];
}

/**
 * Stage 5：过期分析
 * 检查技能树节点内容是否已过时，并给出过期等级。
 */
export const stage5CheckExpire: PromptTemplate<CheckExpireInput, CheckExpireOutput> = {
  version: 'v1',

  build: (input) => {
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
4. 输出必须是合法 JSON，不要包含 Markdown 代码块外的任何内容。

输出格式：
{
  "suggestions": [
    { "nodeTitle": "现有节点标题", "expireLevel": 2, "reason": "..." },
    ...
  ]
}
`;
  },

  parse: (raw) => extractJson(raw) as CheckExpireOutput,
};
