import { PromptTemplate, extractJson } from '../prompt-engine';

interface InterviewTopic {
  l1Title: string;
  l2Title: string;
  l2Description?: string;
}

interface InterviewQAInput {
  treeName: string;
  description?: string;
  topics: InterviewTopic[];
}

interface InterviewQuestionItem {
  question: string;
  answer: string;
  difficulty: string;
  topic: string;
}

interface InterviewQAOutput {
  questions: InterviewQuestionItem[];
}

export const stage6InterviewQA: PromptTemplate<InterviewQAInput, InterviewQAOutput> = {
  version: '1.0.0',
  build: (input) => `
角色：你是一位资深技术面试官，擅长围绕知识体系设计高质量的面试题。
任务：为技能树「${input.treeName}」生成一套面试 Q&A，帮助学习者检验与巩固对每个主题的掌握。

输入：
- 技能树名称：${input.treeName}
- 描述：${input.description || '无'}
- 主题列表（L1 领域 → L2 主题）：
${input.topics.map((t) => `  - [${t.l1Title}] ${t.l2Title}${t.l2Description ? '：' + t.l2Description : ''}`).join('\n')}

要求：
1. 覆盖上面列出的每一个 L2 主题，每个主题出 1-3 道面试题，总计 15-25 题。
2. difficulty 只能是 EASY、MEDIUM 或 HARD，三种难度按比例混合（大致 EASY 30%、MEDIUM 45%、HARD 25%）。
3. topic 字段必须原样填写该题所属 L2 主题的标题，不要改写。
4. question 是面试官会真实提出的问题，具体、可回答，避免空泛。
5. answer 是要点式参考答案，200 字以内，条理清晰，可用分号或顿号分隔要点。
6. 输出必须是合法 JSON，不要包含 Markdown 代码块外的任何内容。

输出格式：
{
  "questions": [
    {
      "question": "...",
      "answer": "...",
      "difficulty": "EASY",
      "topic": "..."
    }
  ]
}
`,
  parse: extractJson,
};
