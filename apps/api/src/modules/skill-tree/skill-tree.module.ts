import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiIntegrationModule } from '../ai-integration/ai-integration.module';
import { TreeAccessModule } from '../tree-access/tree-access.module';
import { SkillTree } from './entities/skill-tree.entity';
import { TreeNode } from './entities/tree-node.entity';
import { LearningRecord } from '../learning-record/entities/learning-record.entity';
import { SkillTreeService } from './skill-tree.service';
import { SkillTreeController } from './skill-tree.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SkillTree, TreeNode, LearningRecord]),
    AiIntegrationModule,
    TreeAccessModule,
  ],
  providers: [SkillTreeService],
  controllers: [SkillTreeController],
  exports: [SkillTreeService, TypeOrmModule],
})
export class SkillTreeModule {}
