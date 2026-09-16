import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TreeType, NodeLevel, LearningStatus } from '@skill/shared';
import { SkillTree } from './entities/skill-tree.entity';
import { TreeNode } from './entities/tree-node.entity';
import { LearningRecord } from '../learning-record/entities/learning-record.entity';
import { AiIntegrationService } from '../ai-integration/ai-integration.service';
import { TreeAccessService } from '../tree-access/tree-access.service';

@Injectable()
export class SkillTreeService {
  constructor(
    @InjectRepository(SkillTree)
    private treeRepo: Repository<SkillTree>,
    @InjectRepository(TreeNode)
    private nodeRepo: Repository<TreeNode>,
    @InjectRepository(LearningRecord)
    private recordRepo: Repository<LearningRecord>,
    private aiService: AiIntegrationService,
    private treeAccess: TreeAccessService,
    private dataSource: DataSource,
  ) {}

  /**
   * 先算后落库：
   * ① AI 生成 L1 大纲在事务外（此时树还没建，只带 userId 做审计）
   * ② 校验通过后用一个事务写「树 + L1 节点 + 学习记录」
   *
   * 由此彻底消除「树行已落库、AI 失败、节点与学习记录缺失」的孤儿树（阶段 1 实测到 6 棵）。
   */
  async create(
    data: { name: string; description?: string; type: TreeType; selectedPoints?: string[]; keywords?: string },
    userId: string,
  ): Promise<SkillTree> {
    // ① 先算
    const l1Result = data.selectedPoints?.length
      ? await this.aiService.generateL1FromPoints(
          data.name,
          data.description,
          data.type,
          data.selectedPoints,
          { userId },
        )
      : await this.aiService.generateL1(data.name, data.description, data.type, { userId });

    // ② 后落库（单事务）
    const treeId = await this.dataSource.transaction(async (manager) => {
      const treeRepo = manager.getRepository(SkillTree);
      const nodeRepo = manager.getRepository(TreeNode);
      const recordRepo = manager.getRepository(LearningRecord);

      const tree = await treeRepo.save(
        treeRepo.create({
          name: data.name,
          description: data.description,
          type: data.type,
          keywords: data.keywords,
          status: 'ACTIVE',
          ownerId: userId,
        }),
      );

      if (l1Result.nodes.length > 0) {
        await nodeRepo.save(
          l1Result.nodes.map((node, index) =>
            nodeRepo.create({
              treeId: tree.id,
              level: NodeLevel.L1,
              title: node.title,
              description: node.description,
              sortOrder: index,
            }),
          ),
        );
      }

      await recordRepo.save(
        recordRepo.create({
          userId,
          skillTreeId: tree.id,
          status: LearningStatus.IN_PROGRESS,
        }),
      );

      return tree.id;
    });

    return this.findById(treeId, userId);
  }

  async generateKnowledgePoints(
    data: {
      title: string;
      description?: string;
      type: TreeType;
      keywords?: string;
    },
    userId: string,
  ): Promise<{ points: string[] }> {
    return this.aiService.generateKnowledgePoints(
      {
        title: data.title,
        description: data.description,
        type: data.type,
        keywords: data.keywords,
      },
      { userId },
    );
  }

  async findById(id: string, userId: string): Promise<SkillTree> {
    await this.treeAccess.assertTreeOwner(id, userId);
    return this.loadTree(id);
  }

  /** 内部加载（不做归属校验，供已校验过的调用方使用） */
  private async loadTree(id: string): Promise<SkillTree> {
    const tree = await this.treeRepo.findOne({
      where: { id },
      relations: ['nodes'],
    });
    if (!tree) {
      throw new NotFoundException('Skill tree not found');
    }
    return tree;
  }

  async update(
    id: string,
    data: Partial<Pick<SkillTree, 'name' | 'description' | 'type' | 'keywords'>>,
    userId: string,
  ): Promise<SkillTree> {
    await this.treeAccess.assertTreeOwner(id, userId);
    await this.treeRepo.update(id, data);
    return this.loadTree(id);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.treeAccess.assertTreeOwner(id, userId);
    // 节点、内容、代码示例、练习、学习记录、面试题、分析任务与产物任务
    // 均由外键 ON DELETE CASCADE 清理；推荐指向本树的 skill_tree_id 由 ON DELETE SET NULL 置空
    // （见设计文档 5.2，故此处不再手工删子行）
    await this.treeRepo.delete(id);
  }
}
