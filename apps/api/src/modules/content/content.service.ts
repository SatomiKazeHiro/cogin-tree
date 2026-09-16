import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NodeContent } from './entities/node-content.entity';
import { Exercise } from './entities/exercise.entity';
import { CodeExample } from './entities/code-example.entity';
import { TreeNode } from '../skill-tree/entities/tree-node.entity';
import { SkillTree } from '../skill-tree/entities/skill-tree.entity';
import { AiIntegrationService } from '../ai-integration/ai-integration.service';
import { TreeAccessService } from '../tree-access/tree-access.service';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(NodeContent)
    private contentRepo: Repository<NodeContent>,
    @InjectRepository(Exercise)
    private exerciseRepo: Repository<Exercise>,
    @InjectRepository(CodeExample)
    private codeExampleRepo: Repository<CodeExample>,
    @InjectRepository(TreeNode)
    private nodeRepo: Repository<TreeNode>,
    @InjectRepository(SkillTree)
    private treeRepo: Repository<SkillTree>,
    private aiService: AiIntegrationService,
    private treeAccess: TreeAccessService,
  ) {}

  /** 内部读取：不做归属校验，供已校验过的调用方复用（避免重复查询） */
  private async loadContent(nodeId: string): Promise<NodeContent | null> {
    return this.contentRepo.findOne({
      where: { nodeId },
      relations: ['exercises', 'codeExamples'],
      order: {
        exercises: { sortOrder: 'ASC' },
        codeExamples: { sortOrder: 'ASC' },
      },
    });
  }

  async getContentByNodeId(nodeId: string, userId: string): Promise<NodeContent | null> {
    await this.treeAccess.assertNodeOwner(nodeId, userId);
    return this.loadContent(nodeId);
  }

  async generateContent(nodeId: string, userId: string): Promise<NodeContent> {
    // assertNodeOwner 同时完成「存在性 + 归属」检查并返回节点，省掉一次重复查询
    const node = await this.treeAccess.assertNodeOwner(nodeId, userId);

    const existing = await this.loadContent(nodeId);
    if (existing) {
      return existing;
    }

    const l1Node = await this.nodeRepo.findOne({ where: { id: node.parentId } });
    const tree = await this.treeRepo.findOne({ where: { id: node.treeId } });

    try {
      const result = await this.aiService.generateL3(
        l1Node?.title || '',
        node.title,
        tree?.name || '',
      );

      const content = this.contentRepo.create({
        nodeId,
        coreText: result.coreText,
        version: 1,
      });
      const saved = await this.contentRepo.save(content);

      const codeExamples = (result.codeExamples || []).map((item, index) =>
        this.codeExampleRepo.create({
          nodeContentId: saved.id,
          title: item.title,
          language: item.language,
          code: item.code,
          sortOrder: index,
        }),
      );
      if (codeExamples.length > 0) {
        await this.codeExampleRepo.save(codeExamples);
      }

      const exercises = (result.exercises || []).map((ex, index) =>
        this.exerciseRepo.create({
          nodeContentId: saved.id,
          question: ex.question,
          options: ex.options,
          correctIndex: ex.correctIndex,
          explanation: ex.explanation,
          sortOrder: index,
        }),
      );
      if (exercises.length > 0) {
        await this.exerciseRepo.save(exercises);
      }

      return (await this.loadContent(nodeId)) as NodeContent;
    } catch (err) {
      console.error('[ContentService] generateContent failed', err);
      if (err instanceof HttpException) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'AI 内容生成失败';
      throw new InternalServerErrorException(`内容生成失败：${message}`);
    }
  }

  async updateContent(
    nodeId: string,
    data: Partial<Pick<NodeContent, 'coreText'>>,
    userId: string,
  ): Promise<NodeContent> {
    await this.treeAccess.assertNodeOwner(nodeId, userId);
    await this.contentRepo.update({ nodeId }, data);
    const content = await this.loadContent(nodeId);
    if (!content) {
      throw new NotFoundException('Content not found');
    }
    return content;
  }
}
