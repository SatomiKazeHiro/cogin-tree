import { LearningStatus, NodeLearningStatus } from '@skill/shared';

export interface LearningStatusMeta {
  label: string;
  dotClass: string;
  badgeClass: string;
  buttonClass: string;
}

export const learningStatusMeta: Record<NodeLearningStatus, LearningStatusMeta> = {
  [NodeLearningStatus.NOT_STARTED]: {
    label: '未开始',
    dotClass: 'bg-transparent',
    badgeClass: 'bg-elevated text-secondary',
    buttonClass: 'bg-ink text-surface',
  },
  [NodeLearningStatus.IN_PROGRESS]: {
    label: '学习中',
    dotClass: 'bg-accent',
    badgeClass: 'bg-accent/10 text-accent-text',
    buttonClass: 'bg-accent text-accent-text',
  },
  [NodeLearningStatus.COMPLETED]: {
    label: '已完成',
    dotClass: 'bg-success',
    badgeClass: 'bg-success/10 text-success',
    buttonClass: 'bg-success text-surface',
  },
  [NodeLearningStatus.SKIPPED]: {
    label: '跳过',
    dotClass: 'bg-muted',
    badgeClass: 'bg-muted/10 text-muted',
    buttonClass: 'bg-muted text-surface',
  },
};

export function getLearningStatusMeta(status?: NodeLearningStatus): LearningStatusMeta {
  return status && learningStatusMeta[status]
    ? learningStatusMeta[status]
    : learningStatusMeta[NodeLearningStatus.NOT_STARTED];
}

/** 树级学习状态（LearningRecord.status）的展示元信息。 */
export const treeStatusMeta: Record<LearningStatus, { label: string; badgeClass: string }> = {
  [LearningStatus.IN_PROGRESS]: {
    label: '学习中',
    badgeClass: 'bg-accent/10 text-accent-text',
  },
  [LearningStatus.COMPLETED]: {
    label: '已完成',
    badgeClass: 'bg-success/10 text-success',
  },
  [LearningStatus.ABANDONED]: {
    label: '已放弃',
    badgeClass: 'bg-muted/10 text-muted',
  },
};
