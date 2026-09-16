import { PromptTemplate, extractJson } from '../prompt-engine';

export interface InterviewQAInput {
  treeName: string;
  l1Title: string;
  l2Title: string;
  l2Description?: string;
}

export interface InterviewQuestionItem {
  question: string;
  answer: string;
  difficulty: string;
}

export interface InterviewQAOutput {
  questions: InterviewQuestionItem[];
}

/**
 * Stage 6：面试 Q&A（按 L2 节点出题）
 * 每道题归属调用方指定的 L2 节点，由后端负责落库关联。
 */
export const stage6InterviewQA: PromptTemplate<InterviewQAInput, InterviewQAOutput> = {
  version: '2.0.0',
  build: (input) => `
角色：你是一位资深技术面试官，擅长围绕单个知识点设计高质量的面试题。
任务：针对技能树「${input.treeName}」中的一个学习主题，生成一组面试 Q&A。

输入：
- 所属领域（L1）：${input.l1Title}
- 主题（L2）：${input.l2Title}${input.l2Description ? `：${input.l2Description}` : ''}

要求：
1. 围绕该 L2 主题出 3-5 道面试题，不得跑题到其他领域。
2. difficulty 只能是 EASY、MEDIUM 或 HARD，三种难度混合（至少包含一道 EASY 和一道 MEDIUM 以上）。
3. question 是面试官会真实提出的问题，具体、可回答，避免空泛。
4. answer 是要点式参考答案，200 字以内，条理清晰，可用分号或顿号分隔要点。
5. 输出必须是合法 JSON，不要包含 Markdown 代码块外的任何内容。

输出格式：
{
  "questions": [
    {
      "question": "...",
      "answer": "...",
      "difficulty": "EASY"
    }
  ]
}
`,
  parse: extractJson,
};
