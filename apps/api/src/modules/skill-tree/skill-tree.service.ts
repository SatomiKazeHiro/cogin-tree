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
    data: { name: string; description?: string; type: TreeType },
    userId: string,
  ): Promise<SkillTree> {
    const tree = this.treeRepo.create({
      ...data,
      status: 'ACTIVE',
    });
    const saved = await this.treeRepo.save(tree);

    // Generate L1 nodes via AI
    const l1Result = await this.aiService.generateL1(saved.name, saved.description);
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
    await this.treeRepo.delete(id);
  }
}
