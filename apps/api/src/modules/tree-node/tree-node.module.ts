import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiIntegrationModule } from '../ai-integration/ai-integration.module';
import { TreeNode } from '../skill-tree/entities/tree-node.entity';
import { SkillTree } from '../skill-tree/entities/skill-tree.entity';
import { TreeNodeService } from './tree-node.service';
import { TreeNodeController } from './tree-node.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TreeNode, SkillTree]),
    AiIntegrationModule,
  ],
  providers: [TreeNodeService],
  controllers: [TreeNodeController],
  exports: [TreeNodeService],
})
export class TreeNodeModule {}
