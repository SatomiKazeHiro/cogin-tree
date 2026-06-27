import { NodeLearningStatus } from '@skill/shared';

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
