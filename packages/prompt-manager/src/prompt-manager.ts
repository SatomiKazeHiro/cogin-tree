import * as z from 'zod';
import { PromptTemplate } from './prompt-engine';
import { stage0KnowledgePoints } from './templates/stage-0-knowledge-points';
import { stage1L1Outline } from './templates/stage-1-l1-outline';
import { stage2L2Nodes } from './templates/stage-2-l2-nodes';
import { stage3aL3CoreText } from './templates/stage-3a-l3-core-text';
import { stage3bL3CodeExamples } from './templates/stage-3b-l3-code-examples';
import { stage3cL3Exercises } from './templates/stage-3c-l3-exercises';
import { stage4DiscoverNew } from './templates/stage-4-discover-new';
import { stage5CheckExpire } from './templates/stage-5-check-expire';
import { stage6InterviewQA } from './templates/stage-6-interview-qa';
import { stage7Portrait } from './templates/stage-7-portrait';
import { stage8Recommendations } from './templates/stage-8-recommendations';

/**
 * 模板注册表：stage 名 → 模板。
 *
 * 它同时是「契约即类型」的落点：build 的入参类型与 parse 的返回类型都从这里推导，
 * 因此不再需要 switch 分发，调用方也不必写 as 断言。
 */
export const PROMPT_TEMPLATES = {
  'knowledge-points': stage0KnowledgePoints,
  'l1-outline': stage1L1Outline,
  'l2-nodes': stage2L2Nodes,
  'l3-core-text': stage3aL3CoreText,
  'l3-code-examples': stage3bL3CodeExamples,
  'l3-exercises': stage3cL3Exercises,
  'discover-new': stage4DiscoverNew,
  'check-expire': stage5CheckExpire,
  'interview-qa': stage6InterviewQA,
  portrait: stage7Portrait,
  recommendations: stage8Recommendations,
} as const;

export type PromptStage = keyof typeof PROMPT_TEMPLATES;

export const PROMPT_STAGES = Object.keys(PROMPT_TEMPLATES) as PromptStage[];

/** build 的入参类型，直接取自模板签名 */
export type StageInput<K extends PromptStage> = Parameters<
  (typeof PROMPT_TEMPLATES)[K]['build']
>[0];

/**
 * parse 的返回类型：直接取模板 parse 的返回类型。
 *
 * 不用 z.infer<schema>（迁移期 schema 可选，z.infer<undefined> 无法编译），
 * 也不用 `extends PromptTemplate<unknown, infer O>` 这类条件推断 ——
 * build 的入参在逆变位置，PromptTemplate<具体入参, O> 并不 assignable 到 PromptTemplate<unknown, O>，
 * 会导致推断结果为 never。ReturnType<parse> 既等价又不受变型影响。
 */
export type StageOutput<K extends PromptStage> = ReturnType<
  (typeof PROMPT_TEMPLATES)[K]['parse']
>;

export class PromptManager {
  static build<K extends PromptStage>(stage: K, input: StageInput<K>): string {
    const template = PROMPT_TEMPLATES[stage] as PromptTemplate<StageInput<K>, StageOutput<K>>;
    return template.build(input);
  }

  static parse<K extends PromptStage>(stage: K, raw: string): StageOutput<K> {
    const template = PROMPT_TEMPLATES[stage] as PromptTemplate<StageInput<K>, StageOutput<K>>;
    return template.parse(raw);
  }

  /** 模板版本（落库到 ai_generations.prompt_version） */
  static versionOf(stage: PromptStage): string {
    return PROMPT_TEMPLATES[stage].version;
  }

  /** 契约 schema（格式段与运行时校验的共同来源） */
  static schemaOf(stage: PromptStage): z.ZodType {
    const schema = PROMPT_TEMPLATES[stage].schema;
    if (!schema) {
      throw new Error(`stage ${stage} 缺少 schema 契约（迁移期未完成？）`);
    }
    return schema;
  }
}

export * from './prompt-engine';
export {
  stage0KnowledgePoints,
  stage1L1Outline,
  stage2L2Nodes,
  stage3aL3CoreText,
  stage3bL3CodeExamples,
  stage3cL3Exercises,
  stage4DiscoverNew,
  stage5CheckExpire,
  stage6InterviewQA,
  stage7Portrait,
};
