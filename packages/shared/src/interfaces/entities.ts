import {
  AIProviderType,
  AnalysisJobStatus,
  AnalysisType,
  ExpireLevel,
  InterviewDifficulty,
  LearningStatus,
  NodeLevel,
  NodeStatus,
  PortraitQuestionCategory,
  RecommendationJobStatus,
  RecommendationSource,
  SuggestedAction,
  TreeType,
  UserRole,
} from '../enums';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  avatar?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  userId: string;
  computedPortrait: PortraitSummary;
  portraitUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PortraitSummary {
  summary: string;
  identityTags: string[];
  interestTags: string[];
  goalTags: string[];
  learningStyle: string;
}

export interface PortraitQuestion {
  id: string;
  category: PortraitQuestionCategory;
  question: string;
  options: string[];
  allowMultiple: boolean;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
}

export interface PortraitAnswer {
  id: string;
  profileId: string;
  questionId: string;
  selectedOptions: string[];
  createdAt: Date;
}

export interface SkillTree {
  id: string;
  name: string;
  description: string;
  type: TreeType;
  keywords?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillTreeWithNodes extends SkillTree {
  nodes: TreeNode[];
}

export interface TreeNode {
  id: string;
  treeId: string;
  parentId?: string;
  level: NodeLevel;
  title: string;
  description: string;
  status: NodeStatus;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CodeExample {
  title: string;
  language: string;
  code: string;
}

export interface NodeContent {
  id: string;
  nodeId: string;
  coreText: string;
  codeExamples?: CodeExample[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Exercise {
  id: string;
  nodeContentId: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sortOrder: number;
}

export interface LearningRecord {
  id: string;
  userId: string;
  skillTreeId: string;
  status: LearningStatus;
  startedAt: Date;
  completedAt?: Date;
}

export interface Recommendation {
  id: string;
  userId: string;
  skillTreeId?: string;
  title: string;
  description: string;
  reason: string;
  matchTags: string[];
  suggestedMode?: string;
  keywords: string[];
  source: RecommendationSource;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  expireAt?: Date;
}

export interface RecommendationJob {
  id: string;
  lastRunAt?: Date;
  status: RecommendationJobStatus;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalysisJob {
  id: string;
  targetNodeId: string;
  analysisType: AnalysisType;
  promptSnapshot: string;
  rawResponse?: unknown;
  status: AnalysisJobStatus;
  createdAt: Date;
}

export interface SuggestedChange {
  id: string;
  analysisJobId: string;
  action: SuggestedAction;
  title: string;
  description: string;
  keyPoints?: string;
  expireLevel?: ExpireLevel;
  applied: boolean;
  createdAt: Date;
}

export interface InterviewQuestion {
  id: string;
  treeId: string;
  l2NodeId?: string;
  question: string;
  answer: string;
  difficulty: InterviewDifficulty;
  topic: string;
  sortOrder: number;
  createdAt: Date;
}

export interface GlobalConfig {
  id: string;
  key: string;
  value: unknown;
  description: string;
}

export interface AIProviderConfig {
  provider: AIProviderType;
  apiKey: string;
  model: string;
  baseUrl?: string;
}
