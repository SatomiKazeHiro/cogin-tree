import { PromptTemplate, extractJson } from '../prompt-engine';

export interface L3ContentInput {
  l1Title: string;
  l2Title: string;
  skillTreeName: string;
}

export interface L3ContentOutput {
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
  version: '1.1.0',
  build: (input) => `
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
   - 关键术语、代码片段、函数名等使用行内代码（\`code\`）或加粗（**term**）突出。
   - 每个段落控制在 3-5 句话以内，段落之间留出空行，降低阅读疲劳。
2. codeExamples：提供 1-3 个与知识点直接相关的可运行代码示例。每个示例包含 title（标题）、language（代码语言，如 javascript/typescript/python/go 等）、code（完整或核心代码片段）。如果主题是纯概念性、不需要代码的，可返回空数组。
3. exercises：提供 4-6 道单选题，每道题包含 question、options（4 个选项）、correctIndex（0 开始的正确选项索引）、explanation（答案解析）。
4. 内容应准确、实用、适合自学者。
5. 输出必须是合法 JSON，不要包含 Markdown 代码块外的任何内容。

重要转义规则（必须遵守，否则会导致解析失败）：
- JSON 字符串内部的所有双引号 " 必须使用反斜杠转义为 \\"。
- JSON 字符串内部的所有换行符必须使用 \\n 表示，不能使用真实换行。
- JSON 字符串内部的所有反斜杠 \\ 必须使用 \\\\ 转义。
- 不要在 JSON 末尾添加多余的逗号。
- 不要在 JSON 前后添加解释、注释或 Markdown 标记。

输出格式（严格遵循，只输出如下 JSON 对象）：
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
