import { PromptTemplate, extractJson } from '../prompt-engine';

export interface DiscoverNewInput {
  treeName: string;
  treeType?: string;
  nodes: { level: number; title: string; description?: string; parentTitle?: string }[];
}

export interface DiscoverNewSuggestion {
  parentTitle?: string | null;
  title: string;
  description: string;
  reason: string;
}

export interface DiscoverNewOutput {
  suggestions: DiscoverNewSuggestion[];
}

/**
 * Stage 4：新增分析
 * 审视技能树现有节点，结合技术趋势建议缺失的学习主题。
 */
export const stage4DiscoverNew: PromptTemplate<DiscoverNewInput, DiscoverNewOutput> = {
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
角色：你是一位资深的技术趋势分析师与学习路径规划师。
任务：审视以下技能树的现有结构，结合当前技术趋势，找出树中缺失但值得学习的主题。

输入：
- 技能树名称：${input.treeName}
- 模式：${input.treeType || 'ENTRY'}
- 现有节点：
${nodeList || '（暂无节点）'}

要求：
1. 建议 1-5 个缺失的 L2 级学习主题；只有当现有 L1 完全无法容纳时，才建议新增 L1（parentTitle 为 null）。
2. 每条建议包含：parentTitle（建议挂载的 L1 标题，必须与上方现有 L1 标题逐字一致；新增 L1 时为 null）、title（主题名，5-15 字）、description（一句话描述）、reason（为什么值得补充，结合趋势一句话说明）。
3. 不要建议与现有节点重复或高度重叠的主题。
4. 没有值得补充的也不要硬凑，可以返回空数组。
5. 输出必须是合法 JSON，不要包含 Markdown 代码块外的任何内容。

输出格式：
{
  "suggestions": [
    { "parentTitle": "现有L1标题或null", "title": "...", "description": "...", "reason": "..." },
    ...
  ]
}
`;
  },

  parse: (raw) => extractJson(raw) as DiscoverNewOutput,
};
