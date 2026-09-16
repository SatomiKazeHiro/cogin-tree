import {
  LearningRecord,
  PortraitSummary,
  SkillTree,
  InterviewQuestion,
} from './entities';
import { LearningStatus, NodeLearningStatus, NodeStatus, GenerationTaskStatus } from '../enums';

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

/** 单个产物的状态视图（状态来自 generation_tasks，内容来自各自的业务表） */
export interface ArtifactStatusView {
  status: GenerationTaskStatus;
  attempts: number;
  lastError?: string | null;
}

export interface ArtifactCodeExample {
  title: string;
  language: string;
  code: string;
}

export interface ArtifactExercise {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

/** GET /nodes/:id/artifacts 的响应：三类产物的状态 + 已就绪内容（前端分块渲染依据） */
export interface NodeArtifactsResponse {
  coreText: ArtifactStatusView & { text: string | null };
  codeExamples: ArtifactStatusView & { items: ArtifactCodeExample[] };
  exercises: ArtifactStatusView & { items: ArtifactExercise[] };
}
