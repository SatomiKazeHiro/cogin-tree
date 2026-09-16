/**
 * 九个 stage 的契约自检（正例 + 反例）。
 * 用法：cd packages/prompt-manager; ..\..\apps\api\node_modules\.bin\ts-node src/stages.selfcheck.ts
 */
import { PromptManager, PromptStage } from './prompt-manager';
import { AiContractError } from './prompt-engine';

function assert(cond: boolean, label: string) {
  if (!cond) {
    console.error(`FAIL  ${label}`);
    process.exit(1);
  }
  console.log(`PASS  ${label}`);
}

function expectContractError(stage: PromptStage, raw: string, label: string) {
  try {
    PromptManager.parse(stage, raw);
    assert(false, `${label}（未抛错）`);
  } catch (err) {
    assert(err instanceof AiContractError, label);
  }
}

// ── stage 0：knowledge-points ──────────────────────────────────────
assert(
  PromptManager.parse('knowledge-points', '{"points":["a","b"]}').points.length === 2,
  'knowledge-points 正例',
);
expectContractError('knowledge-points', '{"points":[]}', 'knowledge-points 空数组被拒');
expectContractError('knowledge-points', '{"points":[1,2]}', 'knowledge-points 元素类型错被拒');

// ── stage 1：l1-outline ───────────────────────────────────────────
assert(
  PromptManager.parse('l1-outline', '{"nodes":[{"title":"A","description":"a"}]}').nodes.length === 1,
  'l1-outline 正例',
);
expectContractError('l1-outline', '{"nodes":[{"title":"A"}]}', 'l1-outline 缺 description 被拒');
expectContractError('l1-outline', '{"nodes":[]}', 'l1-outline 空数组被拒');

// ── stage 2：l2-nodes ─────────────────────────────────────────────
assert(
  PromptManager.parse('l2-nodes', '{"nodes":[{"title":"A","description":"a"}]}').nodes.length === 1,
  'l2-nodes 正例',
);
expectContractError('l2-nodes', '{"nodes":[{"description":"a"}]}', 'l2-nodes 缺 title 被拒');

// ── stage 3：l3-content ───────────────────────────────────────────
const l3Ok = JSON.stringify({
  coreText: '# 标题\n正文内容'.padEnd(60, '。'),
  codeExamples: [{ title: '示例', language: 'ts', code: 'const a = 1;' }],
  exercises: [{ question: 'Q', options: ['a', 'b'], correctIndex: 1, explanation: 'E' }],
});
const l3 = PromptManager.parse('l3-content', l3Ok);
assert(l3.exercises.length === 1, 'l3-content 正例');
assert(l3.codeExamples[0].language === 'ts', 'l3-content codeExamples 形状正确');

expectContractError(
  'l3-content',
  JSON.stringify({
    coreText: 'x'.padEnd(60, '。'),
    codeExamples: [],
    exercises: [{ question: 'Q', options: ['a'], correctIndex: 0, explanation: 'E' }],
  }),
  'l3-content 单选题少于 2 个选项被拒',
);
expectContractError(
  'l3-content',
  JSON.stringify({
    coreText: 'x'.padEnd(60, '。'),
    codeExamples: [],
    exercises: [{ question: 'Q', options: ['a', 'b'], correctIndex: 2, explanation: 'E' }],
  }),
  'l3-content correctIndex 越界被 invariants 拒（跨字段）',
);
expectContractError('l3-content', '{"coreText":"x"}', 'l3-content 缺 exercises 被拒');

// ── stage 4：discover-new ─────────────────────────────────────────
assert(
  PromptManager.parse(
    'discover-new',
    JSON.stringify({ suggestions: [{ parentTitle: 'L1', title: 'T', description: 'd', reason: 'r' }] }),
  ).suggestions.length === 1,
  'discover-new 正例',
);
assert(
  PromptManager.parse(
    'discover-new',
    JSON.stringify({ suggestions: [{ parentTitle: null, title: 'T', description: 'd', reason: 'r' }] }),
  ).suggestions[0].parentTitle === null,
  'discover-new 允许 parentTitle=null（新增 L1）',
);
assert(
  PromptManager.parse('discover-new', '{"suggestions":[]}').suggestions.length === 0,
  'discover-new 允许空数组（提示词允许"没有也不硬凑"）',
);
expectContractError('discover-new', '{"suggestions":[{"title":"T"}]}', 'discover-new 缺字段被拒');

// ── stage 5：check-expire ─────────────────────────────────────────
assert(
  PromptManager.parse(
    'check-expire',
    JSON.stringify({ suggestions: [{ nodeTitle: 'N', expireLevel: 2, reason: 'r' }] }),
  ).suggestions[0].expireLevel === 2,
  'check-expire 正例',
);
expectContractError(
  'check-expire',
  JSON.stringify({ suggestions: [{ nodeTitle: 'N', expireLevel: 4, reason: 'r' }] }),
  'check-expire expireLevel 越界被拒',
);
expectContractError(
  'check-expire',
  JSON.stringify({ suggestions: [{ nodeTitle: 'N', reason: 'r' }] }),
  'check-expire 缺 expireLevel 被拒',
);

// ── stage 6：interview-qa ─────────────────────────────────────────
assert(
  PromptManager.parse(
    'interview-qa',
    JSON.stringify({ questions: [{ question: 'Q', answer: 'A', difficulty: 'HARD' }] }),
  ).questions[0].difficulty === 'HARD',
  'interview-qa 正例',
);
expectContractError(
  'interview-qa',
  JSON.stringify({ questions: [{ question: 'Q', answer: 'A', difficulty: 'NIGHTMARE' }] }),
  'interview-qa difficulty 非枚举被拒',
);
expectContractError('interview-qa', '{"questions":[]}', 'interview-qa 空数组被拒');

// ── stage 7：portrait ─────────────────────────────────────────────
assert(
  PromptManager.parse(
    'portrait',
    JSON.stringify({
      summary: 's',
      identityTags: ['a'],
      interestTags: ['b'],
      goalTags: ['c'],
      learningStyle: 'hands-on',
    }),
  ).identityTags[0] === 'a',
  'portrait 正例',
);
expectContractError('portrait', '{"summary":"s"}', 'portrait 缺标签数组被拒');

// ── stage 8：recommendations ──────────────────────────────────────
assert(
  PromptManager.parse(
    'recommendations',
    JSON.stringify({
      recommendations: [
        {
          title: 'T',
          description: 'd',
          reason: 'r',
          matchTags: ['兴趣'],
          suggestedMode: 'ENTRY',
          keywords: ['k'],
        },
      ],
    }),
  ).recommendations[0].suggestedMode === 'ENTRY',
  'recommendations 正例',
);
expectContractError(
  'recommendations',
  JSON.stringify({
    recommendations: [
      { title: 'T', description: 'd', reason: 'r', matchTags: [], suggestedMode: 'WAT', keywords: [] },
    ],
  }),
  'recommendations suggestedMode 非枚举被拒',
);
expectContractError(
  'recommendations',
  JSON.stringify({
    recommendations: Array.from({ length: 11 }, (_, i) => ({
      title: `T${i}`,
      description: 'd',
      reason: 'r',
      matchTags: [],
      suggestedMode: 'ENTRY',
      keywords: [],
    })),
  }),
  'recommendations 超过 10 条被拒（与 MAX_RECOMMENDATIONS 对齐）',
);

// ── 格式段与 schema 同源：build 产出必须含 schema 里每个顶层字段名 ──
const l3Prompt = PromptManager.build('l3-content', {
  l1Title: 'L1',
  l2Title: 'L2',
  skillTreeName: 'T',
});
assert(l3Prompt.includes('"coreText"'), 'l3-content 提示词含 coreText 字段说明');
assert(l3Prompt.includes('"codeExamples"'), 'l3-content 提示词含 codeExamples 字段说明');
assert(l3Prompt.includes('"exercises"'), 'l3-content 提示词含 exercises 字段说明');
assert(
  !l3Prompt.includes('"exercises": {\n  "type": "array"'), // 防御性：确认注入的是 schema 而非手写段
  'l3-content 提示词格式段来自 schema（含 draft-07 结构）',
);

console.log('\nSELFCHECK OK');
