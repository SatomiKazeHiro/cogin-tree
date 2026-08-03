import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InterviewDifficulty, NodeLevel } from '@skill/shared';
import { InterviewQuestion } from './entities/interview-question.entity';
import { SkillTreeService } from '../skill-tree/skill-tree.service';
import { AiIntegrationService } from '../ai-integration/ai-integration.service';

@Injectable()
export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);
  private generating = new Map<string, Promise<InterviewQuestion[]>>();

  constructor(
    @InjectRepository(InterviewQuestion)
    private questionRepo: Repository<InterviewQuestion>,
    private skillTreeService: SkillTreeService,
    private aiService: AiIntegrationService,
  ) {}

  async findForTree(treeId: string): Promise<InterviewQuestion[]> {
    const cached = await this.questionRepo.find({
      where: { treeId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    if (cached.length > 0) {
      return cached;
    }

    // 首次访问：按树生成（同一棵树并发生成去重）
    const existing = this.generating.get(treeId);
    if (existing) {
      return existing;
    }

    const promise = this.generateForTree(treeId).finally(() => {
      this.generating.delete(treeId);
    });
    this.generating.set(treeId, promise);
    return promise;
  }

  private async generateForTree(treeId: string): Promise<InterviewQuestion[]> {
    const tree = await this.skillTreeService.findById(treeId);
    const nodes = tree.nodes || [];

    const l1ById = new Map(
      nodes.filter((n) => n.level === NodeLevel.L1).map((n) => [n.id, n.title]),
    );
    const topics = nodes
      .filter((n) => n.level === NodeLevel.L2)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((n) => ({
        l1Title: (n.parentId && l1ById.get(n.parentId)) || '',
        l2Title: n.title,
        l2Description: n.description,
      }));

    const result = await this.aiService.generateInterviewQA({
      treeName: tree.name,
      description: tree.description,
      topics,
    });

    const questions = (result.questions || []).map((q, index) =>
      this.questionRepo.create({
        treeId,
        question: q.question,
        answer: q.answer,
        difficulty: Object.values(InterviewDifficulty).includes(
          q.difficulty as InterviewDifficulty,
        )
          ? (q.difficulty as InterviewDifficulty)
          : InterviewDifficulty.MEDIUM,
        topic: q.topic || '',
        sortOrder: index,
      }),
    );

    const saved = await this.questionRepo.save(questions);
    this.logger.log(`为技能树 ${tree.name}(${treeId}) 生成 ${saved.length} 道面试题`);
    return saved;
  }
}
