import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillTree } from '../skill-tree/entities/skill-tree.entity';
import { TreeNode } from '../skill-tree/entities/tree-node.entity';
import { TreeAccessService } from './tree-access.service';

/**
 * 归属校验模块：被 skill-tree / tree-node / content / interview / analysis /
 * learning-record 等模块导入，作为「私有技能树」的唯一授权实现。
 */
@Module({
  imports: [TypeOrmModule.forFeature([SkillTree, TreeNode])],
  providers: [TreeAccessService],
  exports: [TreeAccessService],
})
export class TreeAccessModule {}
