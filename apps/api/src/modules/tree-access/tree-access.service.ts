import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkillTree } from '../skill-tree/entities/skill-tree.entity';
import { TreeNode } from '../skill-tree/entities/tree-node.entity';

/**
 * 技能树为私有资源：仅创建者可读写。
 *
 * 所有按 id 访问树/节点的服务都通过本服务校验归属，避免规则散落各处。
 * 语义：不存在 → 404 NotFoundException；存在但非本人 → 403 ForbiddenException
 * （前端可据此区分「资源没了」与「没权限」）。
 *
 * 后续若升级为 Guard，只需替换这一个实现。
 */
@Injectable()
export class TreeAccessService {
  constructor(
    @InjectRepository(SkillTree)
    private readonly treeRepo: Repository<SkillTree>,
    @InjectRepository(TreeNode)
    private readonly nodeRepo: Repository<TreeNode>,
  ) {}

  async assertTreeOwner(treeId: string, userId: string): Promise<SkillTree> {
    const tree = await this.treeRepo.findOne({ where: { id: treeId } });
    if (!tree) {
      throw new NotFoundException('Skill tree not found');
    }
    if (tree.ownerId !== userId) {
      throw new ForbiddenException('无权访问该技能树');
    }
    return tree;
  }

  async assertNodeOwner(nodeId: string, userId: string): Promise<TreeNode> {
    const node = await this.nodeRepo.findOne({ where: { id: nodeId } });
    if (!node) {
      throw new NotFoundException('Node not found');
    }
    await this.assertTreeOwner(node.treeId, userId);
    return node;
  }
}
