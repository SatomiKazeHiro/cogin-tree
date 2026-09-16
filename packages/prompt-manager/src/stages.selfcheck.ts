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
