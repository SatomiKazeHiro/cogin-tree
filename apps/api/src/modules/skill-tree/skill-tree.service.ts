import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  async create(
    data: { name: string; description?: string; type: TreeType; selectedPoints?: string[]; keywords?: string },
    userId: string,
  ): Promise<SkillTree> {
    const tree = this.treeRepo.create({
      name: data.name,
      description: data.description,
      type: data.type,
      keywords: data.keywords,
      status: 'ACTIVE',
      ownerId: userId,
    });
    const saved = await this.treeRepo.save(tree);

    // Generate L1 nodes via AI
    // 此时树已落库，故能带上 treeId；T7 会改为先算后落库（届时 treeId 尚不存在，只带 userId）
    const aiCtx = { userId, treeId: saved.id };
    const l1Result = data.selectedPoints?.length
      ? await this.aiService.generateL1FromPoints(
          saved.name,
          saved.description,
          saved.type,
          data.selectedPoints,
          aiCtx,
        )
      : await this.aiService.generateL1(saved.name, saved.description, saved.type, aiCtx);

    const nodes = (l1Result.nodes || []).map((node, index) =>
      this.nodeRepo.create({
        treeId: saved.id,
        level: NodeLevel.L1,
        title: node.title,
        description: node.description,
        sortOrder: index,
      }),
    );
    if (nodes.length > 0) {
      await this.nodeRepo.save(nodes);
    }

    // Link tree to the creator via a learning record
    const record = this.recordRepo.create({
      userId,
      skillTreeId: saved.id,
      status: LearningStatus.IN_PROGRESS,
    });
    await this.recordRepo.save(record);

    return this.findById(saved.id, userId);
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
