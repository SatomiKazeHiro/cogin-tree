import { stage1L1Outline } from './templates/stage-1-l1-outline';
import { stage2L2Nodes } from './templates/stage-2-l2-nodes';
import { stage3L3Content } from './templates/stage-3-l3-content';
import { stage7Portrait } from './templates/stage-7-portrait';

export type PromptStage = 'l1-outline' | 'l2-nodes' | 'l3-content' | 'portrait';

export class PromptManager {
  static build(stage: PromptStage, input: unknown): string {
    switch (stage) {
      case 'l1-outline':
        return stage1L1Outline.build(input as Parameters<typeof stage1L1Outline.build>[0]);
      case 'l2-nodes':
        return stage2L2Nodes.build(input as Parameters<typeof stage2L2Nodes.build>[0]);
      case 'l3-content':
        return stage3L3Content.build(input as Parameters<typeof stage3L3Content.build>[0]);
      case 'portrait':
        return stage7Portrait.build(input as Parameters<typeof stage7Portrait.build>[0]);
      default:
        throw new Error(`Unknown prompt stage: ${stage}`);
    }
  }

  static parse(stage: PromptStage, raw: string): unknown {
    switch (stage) {
      case 'l1-outline':
        return stage1L1Outline.parse(raw);
      case 'l2-nodes':
        return stage2L2Nodes.parse(raw);
      case 'l3-content':
        return stage3L3Content.parse(raw);
      case 'portrait':
        return stage7Portrait.parse(raw);
      default:
        throw new Error(`Unknown prompt stage: ${stage}`);
    }
  }
}

export * from './prompt-engine';
export { stage1L1Outline, stage2L2Nodes, stage3L3Content, stage7Portrait };
