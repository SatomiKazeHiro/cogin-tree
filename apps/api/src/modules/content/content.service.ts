import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
    @InjectRepository(TreeNode)
    private nodeRepo: Repository<TreeNode>,
    @InjectRepository(SkillTree)
    private treeRepo: Repository<SkillTree>,
    private aiService: AiIntegrationService,
    private treeAccess: TreeAccessService,
    private dataSource: DataSource,
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

  /**
   * 先算后落库：
   * ① AI 调用在事务外（可重试、可审计，且不长时间占用数据库连接）
   * ② 校验通过的 payload 在一个短事务里写全部（内容 + 代码示例 + 练习题）
   * 因此 AI 失败时绝不会留下"有内容没练习"的半成品。
   */
  async generateContent(nodeId: string, userId: string): Promise<NodeContent> {
    // assertNodeOwner 同时完成「存在性 + 归属」检查并返回节点，省掉一次重复查询
    const node = await this.treeAccess.assertNodeOwner(nodeId, userId);

    const existing = await this.loadContent(nodeId);
    if (existing) {
      return existing;
    }

    const l1Node = await this.nodeRepo.findOne({ where: { id: node.parentId } });
    const tree = await this.treeRepo.findOne({ where: { id: node.treeId } });

    // ① 先算
    const result = await this.aiService.generateL3(
      l1Node?.title || '',
      node.title,
      tree?.name || '',
      { userId, treeId: node.treeId, nodeId },
    );

    // ② 后落库（单事务）。契约已保证 codeExamples / exercises 是数组，故不再需要 `|| []` 守卫
    await this.dataSource.transaction(async (manager) => {
      const contentRepo = manager.getRepository(NodeContent);
      const codeExampleRepo = manager.getRepository(CodeExample);
      const exerciseRepo = manager.getRepository(Exercise);

      const saved = await contentRepo.save(
        contentRepo.create({ nodeId, coreText: result.coreText, version: 1 }),
      );

      if (result.codeExamples.length > 0) {
        await codeExampleRepo.save(
          result.codeExamples.map((item, index) =>
            codeExampleRepo.create({
              nodeContentId: saved.id,
              title: item.title,
              language: item.language,
              code: item.code,
              sortOrder: index,
            }),
          ),
        );
      }

      if (result.exercises.length > 0) {
        await exerciseRepo.save(
          result.exercises.map((ex, index) =>
            exerciseRepo.create({
              nodeContentId: saved.id,
              question: ex.question,
              options: ex.options,
              correctIndex: ex.correctIndex,
              explanation: ex.explanation,
              sortOrder: index,
            }),
          ),
        );
      }
    });

    return (await this.loadContent(nodeId)) as NodeContent;
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
