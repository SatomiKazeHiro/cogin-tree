import { PromptTemplate, extractJson } from '../prompt-engine';

export interface PortraitInput {
  identityAnswers: string[];
  interestAnswers: string[];
  goalAnswers: string[];
  backgroundAnswers: string[];
}

export interface PortraitOutput {
  summary: string;
  identityTags: string[];
  interestTags: string[];
  goalTags: string[];
  learningStyle: string;
}

export const stage7Portrait: PromptTemplate<PortraitInput, PortraitOutput> = {
  version: '1.0.0',
  build: (input) => `
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
6. 输出必须是合法 JSON，不要包含 Markdown 代码块外的任何内容。

输出格式：
{
  "summary": "...",
  "identityTags": ["...", "..."],
  "interestTags": ["...", "..."],
  "goalTags": ["...", "..."],
  "learningStyle": "..."
}
`,
  parse: extractJson,
};
