import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NodeLevel, NodeStatus } from '@skill/shared';
import { TreeNode } from '../skill-tree/entities/tree-node.entity';
import { AiIntegrationService } from '../ai-integration/ai-integration.service';
import { SkillTree } from '../skill-tree/entities/skill-tree.entity';

@Injectable()
export class TreeNodeService {
  constructor(
    @InjectRepository(TreeNode)
    private nodeRepo: Repository<TreeNode>,
    @InjectRepository(SkillTree)
    private treeRepo: Repository<SkillTree>,
    private aiService: AiIntegrationService,
  ) {}

  async findById(id: string): Promise<TreeNode> {
    const node = await this.nodeRepo.findOne({ where: { id } });
    if (!node) {
      throw new NotFoundException('Node not found');
    }
    return node;
  }

  async findChildren(parentId: string): Promise<TreeNode[]> {
    return this.nodeRepo.find({
      where: { parentId },
      order: { sortOrder: 'ASC' },
    });
  }

  async expand(id: string): Promise<TreeNode[]> {
    const node = await this.findById(id);

    if (node.level === NodeLevel.L3) {
      throw new Error('L3 nodes cannot be expanded');
    }

    const existingChildren = await this.findChildren(id);
    if (existingChildren.length > 0) {
      return existingChildren;
    }

    const tree = await this.treeRepo.findOne({ where: { id: node.treeId } });
    const skillTreeName = tree?.name || '';

    let result: { nodes: { title: string; description: string }[] };

    if (node.level === NodeLevel.L1) {
      result = await this.aiService.generateL2(
        node.title,
        node.description,
        skillTreeName,
      );
    } else {
      // L2 expansion handled by content module
      return [];
    }

    const nodes = result.nodes.map((n, index) =>
      this.nodeRepo.create({
        treeId: node.treeId,
        parentId: node.id,
        level: NodeLevel.L2,
        title: n.title,
        description: n.description,
        keyPoints: n.title,
        sortOrder: index,
      }),
    );

    return this.nodeRepo.save(nodes);
  }

  async update(id: string, data: Partial<TreeNode>): Promise<TreeNode> {
    await this.nodeRepo.update(id, data);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.nodeRepo.delete(id);
  }
}
