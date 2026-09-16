import * as z from 'zod';

/**
 * 复用的原子 schema。
 *
 * 约束：所有 schema 必须保持 JSON-Schema 可表示（z.toJSONSchema 默认对
 * z.date() / z.transform() / z.custom() / z.bigint() / z.map() / z.set() 等抛错），
 * 跨字段约束一律放到各 stage 的 invariants 回调里。
 */

/** L1/L2 节点条目（stage 1 与 stage 2 共用同一形状） */
export const nodeItemSchema = z.object({
  title: z.string().min(1).max(60).meta({ description: '节点标题，5-15 字' }),
  description: z.string().min(1).max(200).meta({ description: '一句话描述' }),
});

export const outlineSchema = z.object({
  nodes: z.array(nodeItemSchema).min(1).max(20).meta({ description: '节点列表' }),
});
export type OutlineOutput = z.infer<typeof outlineSchema>;

export const codeExampleSchema = z.object({
  title: z.string().min(1).max(120).meta({ description: '示例标题' }),
  language: z
    .string()
    .min(1)
    .max(30)
    .meta({ description: '代码语言，如 javascript/typescript/python/go' }),
  code: z.string().min(1).max(8000).meta({ description: '代码正文' }),
});
export type CodeExampleOutput = z.infer<typeof codeExampleSchema>;

export const exerciseSchema = z.object({
  question: z.string().min(1).max(500).meta({ description: '题干' }),
  options: z.array(z.string().min(1).max(300)).min(2).max(6).meta({ description: '选项，4 个为宜' }),
  correctIndex: z.number().int().min(0).max(5).meta({ description: '正确选项下标，从 0 开始' }),
  explanation: z.string().min(1).max(1000).meta({ description: '答案解析' }),
});
export type ExerciseOutput = z.infer<typeof exerciseSchema>;
