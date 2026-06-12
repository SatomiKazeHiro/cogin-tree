import { PromptTemplate, extractJson } from '../prompt-engine';

interface L3ContentInput {
  l1Title: string;
  l2Title: string;
  skillTreeName: string;
}

interface L3ContentOutput {
  coreText: string;
  codeExamples: { title: string; language: string; code: string }[];
  exercises: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
}

export const stage3L3Content: PromptTemplate<L3ContentInput, L3ContentOutput> = {
  version: '1.0.0',
  build: (input) => `
角色：你是一位资深的技术内容作者和题库设计师。
任务：为一个 L2 节点生成 L3（三级）学习内容、可运行代码示例与练习题。L3 代表"具体学什么"，是可直接学习的知识点。

输入：
- 技能方向：${input.skillTreeName}
- L1 节点：${input.l1Title}
- L2 节点：${input.l2Title}

要求：
1. coreText：用中文撰写 300-800 字的核心学习内容，解释概念、用途、注意事项，结构清晰。
2. codeExamples：提供 1-3 个与知识点直接相关的可运行代码示例，放在核心内容与练习题之间。每个示例包含 title（标题）、language（代码语言，如 javascript/typescript/python/go 等）、code（完整或核心代码片段）。如果主题是纯概念性、不需要代码的，可返回空数组。
3. exercises：提供 4-6 道单选题，每道题包含 question、options（4 个选项）、correctIndex（0 开始的正确选项索引）、explanation（答案解析）。
4. 内容应准确、实用、适合自学者。
5. 输出必须是合法 JSON，不要包含 Markdown 代码块外的任何内容。

输出格式：
{
  "coreText": "...",
  "codeExamples": [
    { "title": "...", "language": "javascript", "code": "..." }
  ],
  "exercises": [
    {
      "question": "...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctIndex": 1,
      "explanation": "..."
    }
  ]
}
`,
  parse: extractJson,
};
