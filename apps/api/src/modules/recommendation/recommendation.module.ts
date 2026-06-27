import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { Recommendation } from './entities/recommendation.entity';
import { UserModule } from '../user/user.module';
import { LearningRecordModule } from '../learning-record/learning-record.module';
import { SkillTreeModule } from '../skill-tree/skill-tree.module';
import { AiIntegrationModule } from '../ai-integration/ai-integration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Recommendation]),
    UserModule,
    LearningRecordModule,
    SkillTreeModule,
    AiIntegrationModule,
  ],
  controllers: [RecommendationController],
  providers: [RecommendationService],
  exports: [RecommendationService],
})
export class RecommendationModule {}
