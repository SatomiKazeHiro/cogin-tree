import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InterviewDifficulty, NodeLevel } from '@skill/shared';
import type { InterviewNodeGroup } from '@skill/shared';
import { InterviewQuestion } from './entities/interview-question.entity';
import { TreeNode } from '../skill-tree/entities/tree-node.entity';
import { SkillTreeService } from '../skill-tree/skill-tree.service';
import { AiIntegrationService } from '../ai-integration/ai-integration.service';

@Injectable()
export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);
  /** 按节点并发生成去重 */
  private generating = new Map<string, Promise<void>>();

  constructor(
    @InjectRepository(InterviewQuestion)
    private questionRepo: Repository<InterviewQuestion>,
    private skillTreeService: SkillTreeService,
    private aiService: AiIntegrationService,
  ) {}

  /**
   * 面试视图：按 L2 节点聚合已有题目；
   * 没有题的 L2 节点触发后台懒生成（不阻塞响应），下次访问时题目自然出现。
   * 归属校验由 SkillTreeService.findById 内的 assertTreeOwner 完成（一次查询同时拿到 nodes）。
   */
  async findForTree(treeId: string, userId: string): Promise<InterviewNodeGroup[]> {
    const tree = await this.skillTreeService.findById(treeId, userId);
    const nodes = tree.nodes || [];

    const l1ById = new Map(
      nodes.filter((n) => n.level === NodeLevel.L1).map((n) => [n.id, n.title]),
    );
    const l2Nodes = nodes
      .filter((n) => n.level === NodeLevel.L2)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const questions = l2Nodes.length
      ? await this.questionRepo.find({
          where: { l2NodeId: In(l2Nodes.map((n) => n.id)) },
          order: { sortOrder: 'ASC', createdAt: 'ASC' },
        })
      : [];
    const questionsByNode = new Map<string, InterviewQuestion[]>();
    for (const q of questions) {
      const list = questionsByNode.get(q.l2NodeId) || [];
      list.push(q);
      questionsByNode.set(q.l2NodeId, list);
    }

    const groups: InterviewNodeGroup[] = [];
    for (const node of l2Nodes) {
      const nodeQuestions = questionsByNode.get(node.id) || [];
      if (nodeQuestions.length === 0) {
        this.generateInBackground(treeId, tree.name, node, l1ById.get(node.parentId || '') || '');
      }
      groups.push({
        nodeId: node.id,
        nodeTitle: node.title,
        l1Title: l1ById.get(node.parentId || '') || '',
        nodeStatus: node.status,
        questions: nodeQuestions,
      });
    }
    return groups;
  }

  private generateInBackground(
    treeId: string,
    treeName: string,
    node: TreeNode,
    l1Title: string,
  ): void {
    const existing = this.generating.get(node.id);
    if (existing) {
      return;
    }
    const promise = this.generateForNode(treeId, treeName, node, l1Title)
      .catch((err) =>
        this.logger.warn(`面试题生成失败 (nodeId=${node.id}): ${err}`),
      )
      .finally(() => {
        this.generating.delete(node.id);
      });
    this.generating.set(node.id, promise);
  }

  private async generateForNode(
    treeId: string,
    treeName: string,
    node: TreeNode,
    l1Title: string,
  ): Promise<void> {
    const result = await this.aiService.generateInterviewQA({
      treeName,
      l1Title,
      l2Title: node.title,
      l2Description: node.description,
    });

    const questions = (result.questions || []).map((q, index) =>
      this.questionRepo.create({
        treeId,
        l2NodeId: node.id,
        question: q.question,
        answer: q.answer,
        difficulty: Object.values(InterviewDifficulty).includes(
          q.difficulty as InterviewDifficulty,
        )
          ? (q.difficulty as InterviewDifficulty)
          : InterviewDifficulty.MEDIUM,
        sortOrder: index,
      }),
    );

    const saved = await this.questionRepo.save(questions);
    this.logger.log(`为节点 ${node.title}(${node.id}) 生成 ${saved.length} 道面试题`);
  }
}
