import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArtifactKind } from '@skill/shared';
import { NodeContent } from './entities/node-content.entity';
import { ArtifactService } from './artifact.service';
import { TreeAccessService } from '../tree-access/tree-access.service';

/**
 * 内容读写（阶段 4 起收窄）：只负责「读内容 / 改核心文本」，
 * 生成编排交给 `ArtifactService`（认领、前置依赖、单事务落库、状态标记）。
 */
@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(NodeContent)
    private contentRepo: Repository<NodeContent>,
    private artifactService: ArtifactService,
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

  /**
   * 兼容旧契约：语义收窄为「确保 coreText 就绪」。
   *
   * 已有内容时直接返回（不调 AI、不重写）—— 生成路径的幂等由 `ArtifactService` 的
   * 数据库认领保证，但这里必须短路，否则「有历史内容但没有 generation_tasks 行」的节点
   * 会被重新生成并覆盖。
   */
  async generateContent(nodeId: string, userId: string): Promise<NodeContent> {
    const existing = await this.loadContent(nodeId);
    if (existing) {
      return existing;
    }

    await this.artifactService.generateArtifact(nodeId, userId, ArtifactKind.L3_CORE_TEXT);

    const content = await this.loadContent(nodeId);
    if (!content) {
      throw new NotFoundException('Content not found');
    }
    return content;
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
