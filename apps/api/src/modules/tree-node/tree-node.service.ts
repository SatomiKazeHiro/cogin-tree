import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NodeLevel } from '@skill/shared';
import { TreeNode } from '../skill-tree/entities/tree-node.entity';
import { AiIntegrationService } from '../ai-integration/ai-integration.service';
import { SkillTree } from '../skill-tree/entities/skill-tree.entity';
import { TreeAccessService } from '../tree-access/tree-access.service';

@Injectable()
export class TreeNodeService {
  constructor(
    @InjectRepository(TreeNode)
    private nodeRepo: Repository<TreeNode>,
    @InjectRepository(SkillTree)
    private treeRepo: Repository<SkillTree>,
    private aiService: AiIntegrationService,
    private treeAccess: TreeAccessService,
  ) {}

  async findById(id: string, userId: string): Promise<TreeNode> {
    return this.treeAccess.assertNodeOwner(id, userId);
  }

  async findChildren(parentId: string, userId: string): Promise<TreeNode[]> {
    await this.treeAccess.assertNodeOwner(parentId, userId);
    return this.nodeRepo.find({
      where: { parentId },
      order: { sortOrder: 'ASC' },
    });
  }

  async expand(id: string, userId: string): Promise<TreeNode[]> {
    const node = await this.treeAccess.assertNodeOwner(id, userId);

    if (node.level === NodeLevel.L3) {
      throw new Error('L3 nodes cannot be expanded');
    }

    const existingChildren = await this.nodeRepo.find({
      where: { parentId: id },
      order: { sortOrder: 'ASC' },
    });
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

    const nodes = (result.nodes || []).map((n, index) =>
      this.nodeRepo.create({
        treeId: node.treeId,
        parentId: node.id,
        level: NodeLevel.L2,
        title: n.title,
        description: n.description,
        sortOrder: index,
      }),
    );

    if (nodes.length === 0) {
      return [];
    }
    return this.nodeRepo.save(nodes);
  }

  async update(
    id: string,
    data: Partial<Pick<TreeNode, 'title' | 'description'>>,
    userId: string,
  ): Promise<TreeNode> {
    await this.treeAccess.assertNodeOwner(id, userId);
    await this.nodeRepo.update(id, data);
    return this.findById(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.treeAccess.assertNodeOwner(id, userId);
    await this.nodeRepo.delete(id);
  }
}
