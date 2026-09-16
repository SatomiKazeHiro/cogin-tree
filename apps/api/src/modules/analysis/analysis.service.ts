import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AnalysisJobStatus,
  AnalysisType,
  ExpireLevel,
  NodeLevel,
  NodeStatus,
  SuggestionAction,
  SuggestionStatus,
} from '@skill/shared';
import { PromptManager } from '@skill/prompt-manager';
import { AnalysisJob } from './entities/analysis-job.entity';
import { SuggestedChange } from './entities/suggested-change.entity';
import { TreeNode } from '../skill-tree/entities/tree-node.entity';
import { SkillTreeService } from '../skill-tree/skill-tree.service';
import { AiIntegrationService } from '../ai-integration/ai-integration.service';
import { TreeAccessService } from '../tree-access/tree-access.service';

interface NodeListItem {
  level: number;
  title: string;
  description?: string;
  parentTitle?: string;
}

const EXPIRE_LEVEL_TO_STATUS: Record<number, NodeStatus> = {
  1: NodeStatus.OUTDATED_I,
  2: NodeStatus.OUTDATED_II,
  3: NodeStatus.OUTDATED_III,
};

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);
  private analyzing = new Map<string, Promise<SuggestedChange[]>>();

  constructor(
    @InjectRepository(AnalysisJob)
    private jobRepo: Repository<AnalysisJob>,
    @InjectRepository(SuggestedChange)
    private suggestionRepo: Repository<SuggestedChange>,
    @InjectRepository(TreeNode)
    private nodeRepo: Repository<TreeNode>,
    private skillTreeService: SkillTreeService,
    private aiService: AiIntegrationService,
    private treeAccess: TreeAccessService,
  ) {}

  /** 对整棵树执行「新增发现 + 过期检查」分析，返回本次产生的建议 */
  async analyze(treeId: string, userId: string): Promise<SuggestedChange[]> {
    // 归属校验由 SkillTreeService.findById 内的 assertTreeOwner 完成
    const existing = this.analyzing.get(treeId);
    if (existing) {
      return existing;
    }

    const promise = this.runAnalysis(treeId, userId).finally(() => {
      this.analyzing.delete(treeId);
    });
    this.analyzing.set(treeId, promise);
    return promise;
  }

  private async runAnalysis(treeId: string, userId: string): Promise<SuggestedChange[]> {
    const tree = await this.skillTreeService.findById(treeId, userId);
    const nodes = tree.nodes || [];

    const l1ById = new Map(
      nodes.filter((n) => n.level === NodeLevel.L1).map((n) => [n.id, n.title]),
    );
    const nodeList: NodeListItem[] = nodes
      .filter((n) => n.level === NodeLevel.L1 || n.level === NodeLevel.L2)
      .sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder)
      .map((n) => ({
        level: n.level,
        title: n.title,
        description: n.description,
        parentTitle: n.parentId ? l1ById.get(n.parentId) : undefined,
      }));

    const input = { treeName: tree.name, treeType: tree.type, nodes: nodeList };

    // 去重：把尚未处理的建议标题喂给 AI，避免重复建议
    const pending = await this.loadPendingSuggestions(treeId);
    const pendingAddTitles = pending
      .filter((s) => s.action === SuggestionAction.ADD)
      .map((s) => s.title);
    const pendingExpireTitles = pending
      .filter((s) => s.action === SuggestionAction.EXPIRE)
      .map((s) => s.title);

    const [discoverResult, expireResult] = await Promise.all([
      this.runJob(
        treeId,
        AnalysisType.DISCOVER_NEW,
        'discover-new',
        { ...input, existingSuggestions: pendingAddTitles },
        () =>
          this.aiService.generateDiscoverNew(
            {
              ...input,
              existingSuggestions: pendingAddTitles,
            },
            { userId, treeId },
          ),
      ),
      this.runJob(
        treeId,
        AnalysisType.CHECK_EXPIRE,
        'check-expire',
        { ...input, existingSuggestions: pendingExpireTitles },
        () =>
          this.aiService.generateCheckExpire(
            {
              ...input,
              existingSuggestions: pendingExpireTitles,
            },
            { userId, treeId },
          ),
      ),
    ]);

    const suggestions: Partial<SuggestedChange>[] = [];

    for (const s of discoverResult?.suggestions || []) {
      suggestions.push({
        jobId: discoverResult!.jobId,
        action: SuggestionAction.ADD,
        title: s.title,
        description: s.description,
        reason: s.reason,
        parentNodeId: s.parentTitle
          ? this.matchNodeId(nodes, s.parentTitle, NodeLevel.L1)
          : undefined,
        status: SuggestionStatus.PENDING,
      });
    }

    for (const s of expireResult?.suggestions || []) {
      const targetNodeId = this.matchNodeId(nodes, s.nodeTitle);
      if (!targetNodeId) {
        this.logger.warn(`过期建议的节点标题无法匹配，已丢弃: ${s.nodeTitle}`);
        continue;
      }
      suggestions.push({
        jobId: expireResult!.jobId,
        action: SuggestionAction.EXPIRE,
        title: s.nodeTitle,
        reason: s.reason,
        targetNodeId,
        expireLevel: this.toExpireLevel(s.expireLevel),
        status: SuggestionStatus.PENDING,
      });
    }

    if (suggestions.length === 0) {
      return [];
    }
    return this.suggestionRepo.save(suggestions.map((s) => this.suggestionRepo.create(s)));
  }

  /** 执行单个分析任务并落库 job（失败不抛错，返回 null） */
  private async runJob<T>(
    treeId: string,
    analysisType: AnalysisType,
    stage: 'discover-new' | 'check-expire',
    input: unknown,
    fn: () => Promise<T>,
  ): Promise<(T & { suggestions?: unknown[] }) & { jobId: string } | null> {
    const promptSnapshot = PromptManager.build(stage, input as never);
    const job = await this.jobRepo.save(
      this.jobRepo.create({
        treeId,
        analysisType,
        promptSnapshot,
        status: AnalysisJobStatus.PENDING,
      }),
    );

    try {
      const result = await fn();
      await this.jobRepo.update(job.id, {
        status: AnalysisJobStatus.COMPLETED,
        rawResponse: result as object,
      });
      return { ...(result as object), jobId: job.id } as T & { jobId: string };
    } catch (err) {
      this.logger.warn(`分析任务失败 (${analysisType}, treeId=${treeId}): ${err}`);
      await this.jobRepo.update(job.id, { status: AnalysisJobStatus.FAILED });
      return null;
    }
  }

  /** 标题 → 节点 id：先精确匹配，再包含匹配；匹配不到返回 undefined */
  private matchNodeId(nodes: TreeNode[], title: string, level?: NodeLevel): string | undefined {
    const pool = level ? nodes.filter((n) => n.level === level) : nodes;
    const exact = pool.find((n) => n.title === title);
    if (exact) return exact.id;
    const fuzzy = pool.find((n) => n.title.includes(title) || title.includes(n.title));
    return fuzzy?.id;
  }

  private toExpireLevel(level: number): ExpireLevel {
    if (level === 3) return ExpireLevel.III;
    if (level === 2) return ExpireLevel.II;
    return ExpireLevel.I;
  }

  /** 内部加载待处理建议（不做归属校验，供已校验过的调用方复用） */
  private async loadPendingSuggestions(treeId: string): Promise<SuggestedChange[]> {
    return this.suggestionRepo.find({
      where: { status: SuggestionStatus.PENDING, job: { treeId } },
      relations: ['job'],
      order: { createdAt: 'ASC' },
    });
  }

  /** 某棵树所有待处理建议 */
  async findPendingSuggestions(treeId: string, userId: string): Promise<SuggestedChange[]> {
    await this.treeAccess.assertTreeOwner(treeId, userId);
    return this.loadPendingSuggestions(treeId);
  }

  /** 采纳建议：ADD 创建节点，EXPIRE 标记节点过期 */
  async applySuggestion(id: string, userId: string): Promise<SuggestedChange> {
    const suggestion = await this.suggestionRepo.findOne({
      where: { id },
      relations: ['job'],
    });
    if (!suggestion) {
      throw new NotFoundException('建议不存在');
    }
    // 归属校验先于状态检查：越权访问不应泄露「该建议是否已处理」
    await this.treeAccess.assertTreeOwner(suggestion.job.treeId, userId);
    if (suggestion.status !== SuggestionStatus.PENDING) {
      throw new BadRequestException('该建议已处理');
    }

    if (suggestion.action === SuggestionAction.ADD) {
      await this.createNodeFromSuggestion(suggestion);
    } else {
      await this.expireNodeFromSuggestion(suggestion);
    }

    suggestion.status = SuggestionStatus.APPLIED;
    return this.suggestionRepo.save(suggestion);
  }

  private async createNodeFromSuggestion(suggestion: SuggestedChange): Promise<void> {
    const treeId = suggestion.job.treeId;

    if (suggestion.parentNodeId) {
      const parent = await this.nodeRepo.findOne({ where: { id: suggestion.parentNodeId } });
      if (!parent) {
        throw new NotFoundException('建议挂载的父节点不存在');
      }
      const siblings = await this.nodeRepo.find({
        where: { parentId: parent.id, level: NodeLevel.L2 },
      });
      await this.nodeRepo.save(
        this.nodeRepo.create({
          treeId,
          parentId: parent.id,
          title: suggestion.title,
          description: suggestion.description,
          level: NodeLevel.L2,
          sortOrder: siblings.length,
          status: NodeStatus.ACTIVE,
        }),
      );
    } else {
      const l1Nodes = await this.nodeRepo.find({
        where: { treeId, level: NodeLevel.L1 },
      });
      await this.nodeRepo.save(
        this.nodeRepo.create({
          treeId,
          title: suggestion.title,
          description: suggestion.description,
          level: NodeLevel.L1,
          sortOrder: l1Nodes.length,
          status: NodeStatus.ACTIVE,
        }),
      );
    }
  }

  private async expireNodeFromSuggestion(suggestion: SuggestedChange): Promise<void> {
    if (!suggestion.targetNodeId) {
      throw new BadRequestException('过期建议缺少目标节点');
    }
    const node = await this.nodeRepo.findOne({ where: { id: suggestion.targetNodeId } });
    if (!node) {
      throw new NotFoundException('目标节点不存在');
    }
    const levelMap: Record<ExpireLevel, NodeStatus> = {
      [ExpireLevel.I]: NodeStatus.OUTDATED_I,
      [ExpireLevel.II]: NodeStatus.OUTDATED_II,
      [ExpireLevel.III]: NodeStatus.OUTDATED_III,
    };
    node.status = levelMap[suggestion.expireLevel || ExpireLevel.I];
    await this.nodeRepo.save(node);
  }

  /** 忽略建议 */
  async ignoreSuggestion(id: string, userId: string): Promise<SuggestedChange> {
    const suggestion = await this.suggestionRepo.findOne({
      where: { id },
      relations: ['job'],
    });
    if (!suggestion) {
      throw new NotFoundException('建议不存在');
    }
    // 归属校验先于状态检查（同 applySuggestion）
    await this.treeAccess.assertTreeOwner(suggestion.job.treeId, userId);
    if (suggestion.status !== SuggestionStatus.PENDING) {
      throw new BadRequestException('该建议已处理');
    }
    suggestion.status = SuggestionStatus.IGNORED;
    return this.suggestionRepo.save(suggestion);
  }
}
