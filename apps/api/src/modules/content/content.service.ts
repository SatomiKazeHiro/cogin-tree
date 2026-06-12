import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NodeContent } from './entities/node-content.entity';
import { Exercise } from './entities/exercise.entity';
import { TreeNode } from '../skill-tree/entities/tree-node.entity';
import { SkillTree } from '../skill-tree/entities/skill-tree.entity';
import { AiIntegrationService } from '../ai-integration/ai-integration.service';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(NodeContent)
    private contentRepo: Repository<NodeContent>,
    @InjectRepository(Exercise)
    private exerciseRepo: Repository<Exercise>,
    @InjectRepository(TreeNode)
    private nodeRepo: Repository<TreeNode>,
    @InjectRepository(SkillTree)
    private treeRepo: Repository<SkillTree>,
    private aiService: AiIntegrationService,
  ) {}

  async getContentByNodeId(nodeId: string): Promise<NodeContent | null> {
    return this.contentRepo.findOne({
      where: { nodeId },
      relations: ['exercises'],
    });
  }

  async generateContent(nodeId: string): Promise<NodeContent> {
    const node = await this.nodeRepo.findOne({ where: { id: nodeId } });
    if (!node) {
      throw new NotFoundException('Node not found');
    }

    const existing = await this.getContentByNodeId(nodeId);
    if (existing) {
      return existing;
    }

    const l2Node = node;
    const l1Node = await this.nodeRepo.findOne({
      where: { id: l2Node.parentId },
    });
    const tree = await this.treeRepo.findOne({
      where: { id: l2Node.treeId },
    });

    const result = await this.aiService.generateL3(
      l1Node?.title || '',
      l2Node.title,
      tree?.name || '',
    );

    const content = this.contentRepo.create({
      nodeId,
      coreText: result.coreText,
      codeExamples: result.codeExamples || [],
      version: 1,
    });
    const saved = await this.contentRepo.save(content);

    const exercises = result.exercises.map((ex, index) =>
      this.exerciseRepo.create({
        nodeContentId: saved.id,
        question: ex.question,
        options: ex.options,
        correctIndex: ex.correctIndex,
        explanation: ex.explanation,
        sortOrder: index,
      }),
    );
    await this.exerciseRepo.save(exercises);

    return this.getContentByNodeId(nodeId) as Promise<NodeContent>;
  }

  async updateContent(
    nodeId: string,
    data: Partial<NodeContent>,
  ): Promise<NodeContent> {
    await this.contentRepo.update({ nodeId }, data);
    const content = await this.getContentByNodeId(nodeId);
    if (!content) {
      throw new NotFoundException('Content not found');
    }
    return content;
  }
}
