import {
  LearningRecord,
  PortraitSummary,
  SkillTree,
} from './entities';
import { LearningStatus, NodeLearningStatus } from '../enums';

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
