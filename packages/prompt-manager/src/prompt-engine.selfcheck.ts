/**
 * 契约基座自检（packages 侧用 ts-node 脚本而非 jest：jest/ts-jest 只装在 apps/api，
 * pnpm 严格隔离下 packages 解析不到）。
 *
 * 用法：cd packages/prompt-manager; ..\..\node_modules\.bin\ts-node src/prompt-engine.selfcheck.ts
 */
import * as z from 'zod';
import { AiContractError, defineTemplate, extractJson } from './prompt-engine';

function assert(cond: boolean, label: string) {
  if (!cond) {
    console.error(`FAIL  ${label}`);
    process.exit(1);
  }
  console.log(`PASS  ${label}`);
}

const demoSchema = z.object({
  nodes: z
    .array(
      z.object({
        title: z.string().min(1).meta({ description: '标题' }),
        description: z.string().min(1).meta({ description: '一句话描述' }),
      }),
    )
    .min(1),
});

const demoTemplate = defineTemplate({
  version: '1.0.0',
  schema: demoSchema,
  body: (input: { topic: string }) => `请为「${input.topic}」生成大纲。`,
});

// ── build：正文 + 由 schema 派生的格式段 ──────────────────────────────
const prompt = demoTemplate.build({ topic: '前端工程化' });
assert(prompt.includes('请为「前端工程化」生成大纲。'), 'build 含提示词正文');
assert(prompt.includes('"nodes"'), 'build 注入 schema 的字段名 nodes');
assert(prompt.includes('"title"'), 'build 注入 schema 的字段名 title');
assert(prompt.includes('标题'), 'build 注入 .meta() 的中文 description');
assert(prompt.includes('"required"'), 'build 注入 required');

// ── parse：正例 ────────────────────────────────────────────────────
const ok = demoTemplate.parse('{"nodes":[{"title":"A","description":"a"}]}');
assert(ok.nodes[0].title === 'A', 'parse 正例返回类型化数据');

// ── parse：形状不符 → schema_mismatch + 字段级 issues ───────────────
try {
  demoTemplate.parse('{"nodes":[{"title":"A"}]}');
  assert(false, 'parse 形状不符应抛错');
} catch (err) {
  const e = err as AiContractError;
  assert(err instanceof AiContractError, 'parse 形状不符抛 AiContractError');
  assert(e.kind === 'schema_mismatch', 'shape 不符归类为 schema_mismatch');
  assert(e.issues.length > 0, 'shape 不符带字段级 issues');
  assert(e.issues.some((i) => i.path.includes('description')), 'issues 指向缺失字段 description');
}

// ── parse：JSON 语法错误 → invalid_json ────────────────────────────
try {
  demoTemplate.parse('这不是 JSON');
  assert(false, 'parse 语法错误应抛错');
} catch (err) {
  assert((err as AiContractError).kind === 'invalid_json', 'JSON 语法错误归类为 invalid_json');
}

// ── parse：JSON 被截断 → truncated ─────────────────────────────────
try {
  demoTemplate.parse('{"nodes":[{"title":"A"');
  assert(false, 'parse 截断应抛错');
} catch (err) {
  assert((err as AiContractError).kind === 'truncated', '截断归类为 truncated');
}

// ── invariants：形状通过后执行 ─────────────────────────────────────
const withInvariant = defineTemplate({
  version: '1.0.0',
  schema: z.object({ items: z.array(z.number().int().min(0)) }),
  invariants: (v) => (v.items.some((n) => n > 10) ? ['items 中的值不得超过 10'] : []),
  body: () => 'x',
});
assert(withInvariant.parse('{"items":[1,2]}').items.length === 2, 'invariants 通过时不抛错');
try {
  withInvariant.parse('{"items":[1,99]}');
  assert(false, 'invariants 违规应抛错');
} catch (err) {
  assert(
    (err as AiContractError).issues.map((i) => i.message).join().includes('不得超过 10'),
    'invariants 违规信息进入 issues',
  );
}

// ── extractJson 行为不变 ────────────────────────────────────────────
assert(
  JSON.stringify(extractJson('```json\n{"a":1}\n```')) === '{"a":1}',
  'extractJson 语法层行为不变',
);

console.log('\nSELFCHECK OK');
