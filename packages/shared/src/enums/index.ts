export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum TreeType {
  ENTRY = 'ENTRY',
  EXPERT = 'EXPERT',
  INTERVIEW = 'INTERVIEW',
}

/**
 * 节点层级。
 *
 * `L3 = 3` 是**保留值**：当前实现只生成/展示 L1、L2（L3 学习内容挂在 L2 节点的
 * `node_contents` 上，不再建 L3 节点）。数据库枚举 `tree_nodes_level_enum` 里同样有 '3'。
 * 之所以不删：删掉需要一次改写该枚举类型的迁移，而保留它不影响任何逻辑（仅占一个枚举值）。
 */
export enum NodeLevel {
  L1 = 1,
  L2 = 2,
  /** 保留未用（见上方说明） */
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

export enum AnalysisJobStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum SuggestionAction {
  ADD = 'ADD',
  EXPIRE = 'EXPIRE',
}

export enum SuggestionStatus {
  PENDING = 'PENDING',
  APPLIED = 'APPLIED',
  IGNORED = 'IGNORED',
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

/** AI 产物种类（一个种类 = 一个契约 + 一个状态） */
export enum ArtifactKind {
  L3_CORE_TEXT = 'L3_CORE_TEXT',
  L3_CODE_EXAMPLES = 'L3_CODE_EXAMPLES',
  L3_EXERCISES = 'L3_EXERCISES',
}

export enum GenerationTaskStatus {
  PENDING = 'PENDING',
  GENERATING = 'GENERATING',
  READY = 'READY',
  FAILED = 'FAILED',
}

export enum AiGenerationErrorKind {
  INVALID_JSON = 'invalid_json',
  TRUNCATED = 'truncated',
  SCHEMA_MISMATCH = 'schema_mismatch',
  PROVIDER_ERROR = 'provider_error',
}
