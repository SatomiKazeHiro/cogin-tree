/**
 * 模板注册表自检。
 * 用法：cd packages/prompt-manager; ..\..\apps\api\node_modules\.bin\ts-node src/prompt-manager.selfcheck.ts
 */
import { PromptManager, PROMPT_STAGES } from './prompt-manager';

function assert(cond: boolean, label: string) {
  if (!cond) {
    console.error(`FAIL  ${label}`);
    process.exit(1);
  }
  console.log(`PASS  ${label}`);
}

assert(PROMPT_STAGES.length === 11, `注册了 11 个 stage（实际 ${PROMPT_STAGES.length}）`);
assert(PROMPT_STAGES.includes('knowledge-points'), '含 knowledge-points');
assert(PROMPT_STAGES.includes('l3-core-text'), '含 l3-core-text');
assert(PROMPT_STAGES.includes('l3-code-examples'), '含 l3-code-examples');
assert(PROMPT_STAGES.includes('l3-exercises'), '含 l3-exercises');
assert(PROMPT_STAGES.includes('recommendations'), '含 recommendations');

const prompt = PromptManager.build('knowledge-points', { title: '前端工程化', type: 'ENTRY' });
assert(prompt.length > 50, 'build 返回提示词');
assert(prompt.includes('前端工程化'), 'build 把入参写入提示词');

// 下面这行的类型由注册表推导：若推导不生效，tsc 会在 parsed.points 上报错
const parsed = PromptManager.parse('knowledge-points', '{"points":["a","b"]}');
assert(parsed.points.length === 2, 'parse 返回类型化结果');

assert(typeof PromptManager.versionOf('l1-outline') === 'string', 'versionOf 可取到版本');

console.log('\nSELFCHECK OK');
