import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../modules/user/entities/user.entity';
import { UserProfile } from '../modules/user/entities/user-profile.entity';
import { PortraitQuestion } from '../modules/portrait/entities/portrait-question.entity';
import { PortraitAnswer } from '../modules/portrait/entities/portrait-answer.entity';
import { SkillTree } from '../modules/skill-tree/entities/skill-tree.entity';
import { TreeNode } from '../modules/skill-tree/entities/tree-node.entity';
import { NodeContent } from '../modules/content/entities/node-content.entity';
import { Exercise } from '../modules/content/entities/exercise.entity';
import { LearningRecord } from '../modules/learning-record/entities/learning-record.entity';
import { NodeLearningRecord } from '../modules/learning-record/entities/node-learning-record.entity';
import { Recommendation } from '../modules/recommendation/entities/recommendation.entity';
import { InterviewQuestion } from '../modules/interview/entities/interview-question.entity';
import { AnalysisJob } from '../modules/analysis/entities/analysis-job.entity';
import { SuggestedChange } from '../modules/analysis/entities/suggested-change.entity';

export function databaseConfig(): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'skill_learning',
    entities: [
      User,
      UserProfile,
      PortraitQuestion,
      PortraitAnswer,
      SkillTree,
      TreeNode,
      NodeContent,
      Exercise,
      LearningRecord,
      NodeLearningRecord,
      Recommendation,
      InterviewQuestion,
      AnalysisJob,
      SuggestedChange,
    ],
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
  };
}
