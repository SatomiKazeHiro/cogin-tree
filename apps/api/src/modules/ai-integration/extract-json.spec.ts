import { extractJson, JsonParseError } from '@skill/prompt-manager';

describe('extractJson', () => {
  it('解析纯 JSON 对象', () => {
    expect(extractJson('{"a": 1}')).toEqual({ a: 1 });
  });

  it('解析 Markdown 代码块包裹的 JSON', () => {
    const raw = '```json\n{"a": 1, "b": [2, 3]}\n```';
    expect(extractJson(raw)).toEqual({ a: 1, b: [2, 3] });
  });

  it('解析无语言标记的代码块', () => {
    expect(extractJson('```\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('从夹杂解释文字的响应中提取平衡 JSON', () => {
    const raw = '好的，以下是结果：\n{"recommendations": []}\n希望对你有帮助';
    expect(extractJson(raw)).toEqual({ recommendations: [] });
  });

  it('JSON 内含代码片段时仍能提取最外层结构', () => {
    const inner = { code: '```js\nconsole.log(1)\n```', ok: true };
    const raw = `前缀文字 ${JSON.stringify(inner)} 后缀`;
    expect(extractJson(raw)).toEqual(inner);
  });

  it('未闭合（被截断）的 JSON 抛出截断提示', () => {
    const raw = '{"recommendations": [{"title": "abc"';
    expect(() => extractJson(raw)).toThrow(JsonParseError);
    expect(() => extractJson(raw)).toThrow(/截断/);
  });

  it('完全非 JSON 内容抛出解析失败', () => {
    expect(() => extractJson('这是一段没有任何 JSON 的文字')).toThrow(
      JsonParseError,
    );
    expect(() => extractJson('这是一段没有任何 JSON 的文字')).toThrow(
      /无法解析为合法 JSON/,
    );
  });

  it('错误对象携带 raw 与 extracted 便于排查', () => {
    try {
      extractJson('no json here');
      fail('应当抛出');
    } catch (e) {
      expect(e).toBeInstanceOf(JsonParseError);
      expect((e as JsonParseError).raw).toBe('no json here');
    }
  });
});
