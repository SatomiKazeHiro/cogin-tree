import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiIntegrationModule } from '../ai-integration/ai-integration.module';
import { TreeAccessModule } from '../tree-access/tree-access.module';
import { NodeContent } from './entities/node-content.entity';
import { Exercise } from './entities/exercise.entity';
import { CodeExample } from './entities/code-example.entity';
import { GenerationTask } from './entities/generation-task.entity';
import { TreeNode } from '../skill-tree/entities/tree-node.entity';
import { SkillTree } from '../skill-tree/entities/skill-tree.entity';
import { ContentService } from './content.service';
import { ArtifactService } from './artifact.service';
import { GenerationTaskService } from './generation-task.service';
import { ContentController } from './content.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NodeContent,
      Exercise,
      CodeExample,
      GenerationTask,
      TreeNode,
      SkillTree,
    ]),
    AiIntegrationModule,
    TreeAccessModule,
  ],
  providers: [ContentService, ArtifactService, GenerationTaskService],
  controllers: [ContentController],
  exports: [ContentService, ArtifactService],
})
export class ContentModule {}
