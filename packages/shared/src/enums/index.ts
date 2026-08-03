export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum TreeType {
  ENTRY = 'ENTRY',
  EXPERT = 'EXPERT',
  INTERVIEW = 'INTERVIEW',
}

export enum NodeLevel {
  L1 = 1,
  L2 = 2,
  L3 = 3,
}

export enum NodeStatus {
  ACTIVE = 'ACTIVE',
  OUTDATED_I = 'OUTDATED_I',
  OUTDATED_II = 'OUTDATED_II',
  OUTDATED_III = 'OUTDATED_III',
}

export enum LearningStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED',
}

export enum NodeLearningStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
}

export enum PortraitQuestionCategory {
  IDENTITY = 'IDENTITY',
  INTEREST = 'INTEREST',
  GOAL = 'GOAL',
  BACKGROUND = 'BACKGROUND',
}

export enum RecommendationSource {
  AI_GENERATED = 'AI_GENERATED',
  MANUAL = 'MANUAL',
}

export enum AnalysisType {
  DISCOVER_NEW = 'DISCOVER_NEW',
  CHECK_EXPIRE = 'CHECK_EXPIRE',
}

export enum SuggestedAction {
  ADD = 'ADD',
  EXPIRE = 'EXPIRE',
}

export enum AnalysisJobStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum RecommendationJobStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum ExpireLevel {
  I = 'I',
  II = 'II',
  III = 'III',
}

export enum InterviewDifficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export enum AIProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  DEEPSEEK = 'deepseek',
  MOCK = 'mock',
}
