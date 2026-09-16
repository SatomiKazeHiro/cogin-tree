import {
  LearningRecord,
  PortraitSummary,
  SkillTree,
  InterviewQuestion,
} from './entities';
import { LearningStatus, NodeLearningStatus, NodeStatus } from '../enums';

export interface CurrentLearningItem {
  skillTreeId: string;
  skillTree: SkillTree | null;
  status: LearningStatus;
  progress: number;
  lastNode: {
    id: string;
    title: string;
    status: NodeLearningStatus;
    updatedAt: string;
  } | null;
}

export interface DashboardResponse {
  portrait: PortraitSummary | null;
  learningRecords: (LearningRecord & { skillTree: SkillTree | null; progress: number })[];
  currentLearning: CurrentLearningItem[];
}

/** 面试视图：按 L2 节点分组的 Q&A（路线 C：题目为节点的派生数据） */
export interface InterviewNodeGroup {
  nodeId: string;
  nodeTitle: string;
  l1Title: string;
  nodeStatus: NodeStatus;
  questions: InterviewQuestion[];
}
