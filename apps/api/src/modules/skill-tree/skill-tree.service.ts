import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TreeType, NodeLevel, LearningStatus } from '@skill/shared';
import { SkillTree } from './entities/skill-tree.entity';
import { TreeNode } from './entities/tree-node.entity';
import { LearningRecord } from '../learning-record/entities/learning-record.entity';
import { AiIntegrationService } from '../ai-integration/ai-integration.service';

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
  ) {}

  async create(
    data: { name: string; description?: string; type: TreeType; selectedPoints?: string[] },
    userId: string,
  ): Promise<SkillTree> {
    const tree = this.treeRepo.create({
      name: data.name,
      description: data.description,
      type: data.type,
      status: 'ACTIVE',
    });
    const saved = await this.treeRepo.save(tree);

    // Generate L1 nodes via AI
    const l1Result = data.selectedPoints?.length
      ? await this.aiService.generateL1FromPoints(
          saved.name,
          saved.description,
          saved.type,
          data.selectedPoints,
        )
      : await this.aiService.generateL1(saved.name, saved.description, saved.type);

    const nodes = l1Result.nodes.map((node, index) =>
      this.nodeRepo.create({
        treeId: saved.id,
        level: NodeLevel.L1,
        title: node.title,
        description: node.description,
        keyPoints: node.title,
        sortOrder: index,
      }),
    );
    await this.nodeRepo.save(nodes);

    // Link tree to the creator via a learning record
    const record = this.recordRepo.create({
      userId,
      skillTreeId: saved.id,
      status: LearningStatus.IN_PROGRESS,
    });
    await this.recordRepo.save(record);

    return this.findById(saved.id);
  }

  async generateKnowledgePoints(data: {
    title: string;
    description?: string;
    type: TreeType;
    keywords?: string;
  }): Promise<{ points: string[] }> {
    return this.aiService.generateKnowledgePoints({
      title: data.title,
      description: data.description,
      type: data.type,
      keywords: data.keywords,
    });
  }

  async findById(id: string): Promise<SkillTree> {
    const tree = await this.treeRepo.findOne({
      where: { id },
      relations: ['nodes'],
    });
    if (!tree) {
      throw new NotFoundException('Skill tree not found');
    }
    return tree;
  }

  async findByUser(userId: string): Promise<SkillTree[]> {
    const records = await this.recordRepo.find({
      where: { userId },
      order: { startedAt: 'DESC' },
    });
    const treeIds = records.map((r) => r.skillTreeId);
    if (treeIds.length === 0) {
      return [];
    }
    return this.treeRepo.find({
      where: { id: In(treeIds) },
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: string,
    data: Partial<SkillTree>,
  ): Promise<SkillTree> {
    await this.treeRepo.update(id, data);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    // Detach recommendations before deleting the tree to avoid FK violation.
    await this.treeRepo.manager
      .createQueryBuilder()
      .update('recommendations')
      .set({ skill_tree_id: null })
      .where('skill_tree_id = :id', { id })
      .execute();

    const nodes = await this.nodeRepo.find({ where: { treeId: id } });
    const nodeIds = nodes.map((n) => n.id);

    if (nodeIds.length > 0) {
      // Exercises cascade from node_contents; delete contents first.
      await this.nodeRepo.manager
        .createQueryBuilder()
        .delete()
        .from('node_contents')
        .where('node_id IN (:...nodeIds)', { nodeIds })
        .execute();
    }

    await this.nodeRepo.delete({ treeId: id });
    await this.recordRepo.delete({ skillTreeId: id });
    await this.treeRepo.delete(id);
  }
}
