import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { AnalysisJob } from './entities/analysis-job.entity';
import { SuggestedChange } from './entities/suggested-change.entity';
import { TreeNode } from '../skill-tree/entities/tree-node.entity';
import { SkillTreeModule } from '../skill-tree/skill-tree.module';
import { TreeAccessModule } from '../tree-access/tree-access.module';
import { AiIntegrationModule } from '../ai-integration/ai-integration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalysisJob, SuggestedChange, TreeNode]),
    SkillTreeModule,
    TreeAccessModule,
    AiIntegrationModule,
  ],
  controllers: [AnalysisController],
  providers: [AnalysisService],
})
export class AnalysisModule {}
