import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  ArtifactKind,
  ArtifactStatusView,
  GenerationTaskStatus,
  NodeArtifactsResponse,
  NodeStatus,
} from '@skill/shared';
import { PromptManager, PromptStage } from '@skill/prompt-manager';
import { NodeContent } from './entities/node-content.entity';
import { CodeExample } from './entities/code-example.entity';
import { Exercise } from './entities/exercise.entity';
import { GenerationTask } from './entities/generation-task.entity';
import { TreeNode } from '../skill-tree/entities/tree-node.entity';
import { SkillTree } from '../skill-tree/entities/skill-tree.entity';
import { AiIntegrationService } from '../ai-integration/ai-integration.service';
import { TreeAccessService } from '../tree-access/tree-access.service';
import { GenerationTaskService } from './generation-task.service';

/**
 * 等待「他人生成中的 coreText」落库的总预算；超过即显式失败。
 * 取值依据：实测 coreText 平均 7.4s、最坏也不过十几秒，60s 足够覆盖并留出余量，
 * 同时短于 120s 的陈旧认领阈值（避免与回收逻辑互相打架）。
 */
export const CORE_TEXT_WAIT_MS = 60_000;

/** 等待 coreText 时的轮询间隔（同时充当认领重试间隔） */
export const CORE_TEXT_POLL_MS = 1_000;

/**
 * 产物编排：认领 → 前置依赖 → 调 AI → 单事务落库 → 标记状态。
 *
 * 职责边界：
 * - 状态机（认领/标记）归 `GenerationTaskService`
 * - 内容读写与 AI 调用归本服务
 * 因此「谁有权生成」由数据库裁决，本服务只关心「生成什么、怎么落库」。
 */
@Injectable()
export class ArtifactService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tasks: GenerationTaskService,
    private readonly ai: AiIntegrationService,
    private readonly treeAccess: TreeAccessService,
    @InjectRepository(TreeNode)
    private readonly nodeRepo: Repository<TreeNode>,
    @InjectRepository(SkillTree)
    private readonly treeRepo: Repository<SkillTree>,
    @InjectRepository(NodeContent)
    private readonly contentRepo: Repository<NodeContent>,
  ) {}

  private async loadContext(nodeId: string, userId: string) {
    const node = await this.treeAccess.assertNodeOwner(nodeId, userId);
    const [l1Node, tree] = await Promise.all([
      this.nodeRepo.findOne({ where: { id: node.parentId } }),
      this.treeRepo.findOne({ where: { id: node.treeId } }),
    ]);
    return { node, skillTreeName: tree?.name || '', l1Title: l1Node?.title || '' };
  }

  private async loadContent(nodeId: string): Promise<NodeContent | null> {
    return this.contentRepo.findOne({
      where: { nodeId },
      relations: ['exercises', 'codeExamples'],
      order: { exercises: { sortOrder: 'ASC' }, codeExamples: { sortOrder: 'ASC' } },
    });
  }

  /**
   * 确保 coreText 就绪（供 codeExamples / exercises 作为前置依赖调用）。
   *
   * 关键：coreText 可能**正由另一个请求生成**（典型场景：用户点开 L2 后立刻切到「练习题」
   * tab，两个请求并发）。此时认领会失败，但这是正常的并发状态、不是错误 —— 必须等对方
   * 落库后继续。若直接抛错，会出现「对方生成成功、用户却拿到 500」，并给状态机写一条
   * 假的 FAILED（内容根本不是 AI 生成失败，只是还没轮到读）。
   *
   * 轮询同时也在重试认领：若对方最终失败并把任务标记为 FAILED，下一次循环就能接管生成。
   * 只有超过总预算才显式失败（此时对方大概率已僵死，120s 后陈旧认领会回收）。
   */
  private async ensureCoreText(nodeId: string, userId: string): Promise<string> {
    const deadline = Date.now() + CORE_TEXT_WAIT_MS;

    for (;;) {
      const existing = await this.loadContent(nodeId);
      if (existing?.coreText) return existing.coreText;

      // 认领成功 → 本次生成，返回值里就带刚写入的内容；认领失败 → 他人正在生成
      const view = await this.generateArtifact(nodeId, userId, ArtifactKind.L3_CORE_TEXT);
      if (view.coreText.text) return view.coreText.text;

      if (Date.now() >= deadline) {
        throw new InternalServerErrorException(
          `等待 coreText 生成超时（${CORE_TEXT_WAIT_MS / 1000}s），请稍后重试`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, CORE_TEXT_POLL_MS));
    }
  }

  /**
   * 生成某一类产物（幂等入口）。
   *
   * 幂等性来自 `tasks.claim`：已 READY 或他人生成中（未超时）时拿不到认领，
   * 直接返回当前状态，绝不重复调 AI。要**换新**已就绪的产物请用 `regenerate*`。
   */
  async generateArtifact(
    nodeId: string,
    userId: string,
    kind: ArtifactKind,
  ): Promise<NodeArtifactsResponse> {
    return this.generate(nodeId, userId, kind, { force: false });
  }

  /**
   * 重新生成某一类产物：`READY` 也允许换新（force 认领）。
   * 重新生成 coreText 时按 D14 作废依赖产物、按 D13 清过期标记。
   */
  async regenerateArtifact(
    nodeId: string,
    userId: string,
    kind: ArtifactKind,
  ): Promise<NodeArtifactsResponse> {
    return this.generate(nodeId, userId, kind, { force: true });
  }

  /**
   * 节点级「重新生成」：重生成正文 + 作废下游产物。
   *
   * 下游（代码示例 / 练习题）的输入就是正文，正文换新后它们已按 D14 作废，
   * 会跟随消费时机重新生成 —— 所以「一键」不等于连打三次 AI 调用。
   */
  async regenerateNode(nodeId: string, userId: string): Promise<NodeArtifactsResponse> {
    return this.generate(nodeId, userId, ArtifactKind.L3_CORE_TEXT, { force: true });
  }

  private async generate(
    nodeId: string,
    userId: string,
    kind: ArtifactKind,
    opts: { force: boolean },
  ): Promise<NodeArtifactsResponse> {
    const { node, skillTreeName, l1Title } = await this.loadContext(nodeId, userId);
    const aiCtx = { userId, treeId: node.treeId, nodeId };

    const claimed = await this.tasks.claim(nodeId, kind, opts.force);
    if (!claimed) {
      // 已 READY（且未 force）或他人正在生成：幂等返回当前状态，绝不重复调 AI
      return this.getArtifacts(nodeId, userId);
    }

    try {
      if (kind === ArtifactKind.L3_CORE_TEXT) {
        const result = await this.ai.generateL3CoreText(
          { skillTreeName, l1Title, l2Title: node.title },
          aiCtx,
        );
        await this.dataSource.transaction(async (manager) => {
          const repo = manager.getRepository(NodeContent);
          const existing = await repo.findOne({ where: { nodeId } });
          if (existing) {
            // 覆盖式更新 + version 递增（设计文档 D9：不建版本历史表）
            await repo.update(
              { nodeId },
              { coreText: result.coreText, version: existing.version + 1 },
            );
            // 依赖产物由**旧正文**派生，正文换新后必须作废（D14）：
            // 删内容行 + 任务置 PENDING，之后按消费时机重新生成
            await manager.getRepository(CodeExample).delete({ nodeContentId: existing.id });
            await manager.getRepository(Exercise).delete({ nodeContentId: existing.id });
            await manager.getRepository(GenerationTask).update(
              {
                nodeId,
                artifactKind: In([
                  ArtifactKind.L3_CODE_EXAMPLES,
                  ArtifactKind.L3_EXERCISES,
                ]),
              },
              {
                status: GenerationTaskStatus.PENDING,
                lastError: null,
                finishedAt: null,
              },
            );
          } else {
            await repo.save(repo.create({ nodeId, coreText: result.coreText, version: 1 }));
          }
        });

        // D13：I/II 是「内容需刷新」，重生成即已修复；III 是主题淘汰，刷新正文不解决问题
        if (
          node.status === NodeStatus.OUTDATED_I ||
          node.status === NodeStatus.OUTDATED_II
        ) {
          await this.nodeRepo.update({ id: nodeId }, { status: NodeStatus.ACTIVE });
        }
      } else {
        // 前置依赖：示例与练习题都以 coreText 为依据
        const coreText = await this.ensureCoreText(nodeId, userId);

        if (kind === ArtifactKind.L3_CODE_EXAMPLES) {
          const result = await this.ai.generateL3CodeExamples(
            { skillTreeName, l1Title, l2Title: node.title, coreText },
            aiCtx,
          );
          await this.dataSource.transaction(async (manager) => {
            const contentRepo = manager.getRepository(NodeContent);
            const codeRepo = manager.getRepository(CodeExample);
            const content = await contentRepo.findOne({ where: { nodeId } });
            if (!content) {
              throw new InternalServerErrorException('缺少 node_contents，无法写入代码示例');
            }
            // 先删后写：重新生成时不留旧示例
            await codeRepo.delete({ nodeContentId: content.id });
            if (result.codeExamples.length > 0) {
              await codeRepo.save(
                result.codeExamples.map((item, index) =>
                  codeRepo.create({
                    nodeContentId: content.id,
                    title: item.title,
                    language: item.language,
                    code: item.code,
                    sortOrder: index,
                  }),
                ),
              );
            }
          });
        } else {
          const result = await this.ai.generateL3Exercises(
            { skillTreeName, l1Title, l2Title: node.title, coreText },
            aiCtx,
          );
          await this.dataSource.transaction(async (manager) => {
            const contentRepo = manager.getRepository(NodeContent);
            const exerciseRepo = manager.getRepository(Exercise);
            const content = await contentRepo.findOne({ where: { nodeId } });
            if (!content) {
              throw new InternalServerErrorException('缺少 node_contents，无法写入练习题');
            }
            await exerciseRepo.delete({ nodeContentId: content.id });
            await exerciseRepo.save(
              result.exercises.map((ex, index) =>
                exerciseRepo.create({
                  nodeContentId: content.id,
                  question: ex.question,
                  options: ex.options,
                  correctIndex: ex.correctIndex,
                  explanation: ex.explanation,
                  sortOrder: index,
                }),
              ),
            );
          });
        }
      }

      await this.tasks.markReady(nodeId, kind, {
        promptVersion: PromptManager.versionOf(this.stageOf(kind)),
      });
      return this.getArtifacts(nodeId, userId);
    } catch (err) {
      await this.tasks.markFailed(nodeId, kind, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  /** 三类产物的状态 + 已就绪内容 + 节点时效状态 */
  async getArtifacts(nodeId: string, userId: string): Promise<NodeArtifactsResponse> {
    const node = await this.treeAccess.assertNodeOwner(nodeId, userId);
    const [tasks, content] = await Promise.all([
      this.tasks.findForNode(nodeId),
      this.loadContent(nodeId),
    ]);

    // 兼容「无 task 行但内容已存在」（阶段 3 的历史数据、直写数据库）：按 READY 呈现
    const viewOf = (kind: ArtifactKind, hasContent: boolean): ArtifactStatusView => {
      const task = tasks.find((t) => t.artifactKind === kind);
      return {
        status:
          task?.status ??
          (hasContent ? GenerationTaskStatus.READY : GenerationTaskStatus.PENDING),
        attempts: task?.attempts ?? 0,
        lastError: task?.lastError ?? null,
      };
    };

    return {
      nodeStatus: node.status,
      coreText: {
        ...viewOf(ArtifactKind.L3_CORE_TEXT, !!content?.coreText),
        text: content?.coreText ?? null,
      },
      codeExamples: {
        ...viewOf(ArtifactKind.L3_CODE_EXAMPLES, (content?.codeExamples?.length ?? 0) > 0),
        items: (content?.codeExamples ?? []).map((c) => ({
          title: c.title,
          language: c.language,
          code: c.code,
        })),
      },
      exercises: {
        ...viewOf(ArtifactKind.L3_EXERCISES, (content?.exercises?.length ?? 0) > 0),
        items: (content?.exercises ?? []).map((e) => ({
          question: e.question,
          options: e.options,
          correctIndex: e.correctIndex,
          explanation: e.explanation,
        })),
      },
    };
  }

  private stageOf(kind: ArtifactKind): PromptStage {
    switch (kind) {
      case ArtifactKind.L3_CORE_TEXT:
        return 'l3-core-text';
      case ArtifactKind.L3_CODE_EXAMPLES:
        return 'l3-code-examples';
      default:
        return 'l3-exercises';
    }
  }
}
