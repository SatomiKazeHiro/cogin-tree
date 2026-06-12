import {
  AIProviderConfig,
  CodeExample,
  LearningRecord,
  PortraitAnswer,
  PortraitQuestion,
  PortraitSummary,
  SkillTree,
  TreeNode,
} from './entities';

export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

export interface SubmitPortraitRequest {
  answers: {
    questionId: string;
    selectedOptions: string[];
  }[];
}

export interface PortraitQuestionsResponse {
  categories: string[];
  questions: PortraitQuestion[];
}

export interface CreateSkillTreeRequest {
  name: string;
  description?: string;
  type: string;
}

export interface CreateSkillTreeFromRecommendationRequest {
  recommendationId: string;
  type: string;
}

export interface SkillTreeDetailResponse extends SkillTree {
  nodes: TreeNode[];
}

export interface ExpandNodeResponse {
  nodes: TreeNode[];
}

export interface NodeContentResponse {
  id: string;
  nodeId: string;
  coreText: string;
  codeExamples: CodeExample[];
  exercises: {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
}

export interface UpdateLearningRecordRequest {
  status: string;
}

export interface DashboardResponse {
  portrait: PortraitSummary | null;
  learningRecords: (LearningRecord & { skillTree: SkillTree; progress: number })[];
  recommendations: {
    id: string;
    title: string;
    description: string;
    reason: string;
    matchTags: string[];
    suggestedMode: string;
  }[];
}

export interface UpdateAIConfigRequest extends AIProviderConfig {}
