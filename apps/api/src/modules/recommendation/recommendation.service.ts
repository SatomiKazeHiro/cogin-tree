import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  LearningStatus,
  RecommendationSource,
  TreeType,
  MAX_RECOMMENDATIONS,
} from '@skill/shared';
import { Recommendation } from './entities/recommendation.entity';
import { UserService } from '../user/user.service';
import { LearningRecordService } from '../learning-record/learning-record.service';
import { SkillTreeService } from '../skill-tree/skill-tree.service';
import { AiIntegrationService } from '../ai-integration/ai-integration.service';

const RECOMMENDATION_TTL_DAYS = 3;

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);
  private generating = new Map<string, Promise<Recommendation[]>>();

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Recommendation)
    private recommendationRepo: Repository<Recommendation>,
    private userService: UserService,
    private learningRecordService: LearningRecordService,
    private skillTreeService: SkillTreeService,
    private aiService: AiIntegrationService,
  ) {}

  async findForUser(userId: string): Promise<Recommendation[]> {
    const active = await this.findActiveByUser(userId);

    // 首次使用、无任何推荐：只能阻塞生成
    if (active.length === 0) {
      return this.refreshForUser(userId);
    }

    const allValid = active.every((r) => r.expireAt && r.expireAt > new Date());
    if (allValid) {
      return active;
    }

    // 已过期：先返回旧数据，后台异步刷新
    this.refreshInBackground(userId);
    return active;
  }

  private refreshInBackground(userId: string): void {
    void this.refreshForUser(userId).catch((err) =>
      this.logger.warn(`后台刷新推荐失败 (userId=${userId}): ${err}`),
    );
  }

  async findActiveByUser(userId: string): Promise<Recommendation[]> {
    return this.recommendationRepo.find({
      where: { userId, isActive: true },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async refreshForUser(userId: string): Promise<Recommendation[]> {
    const existing = this.generating.get(userId);
    if (existing) {
      return existing;
    }

    const promise = this.generateForUser(userId).finally(() => {
      this.generating.delete(userId);
    });

    this.generating.set(userId, promise);
    return promise;
  }

  async generateForUser(userId: string): Promise<Recommendation[]> {
    const profile = await this.userService.getProfile(userId);
    const portrait = (profile?.computedPortrait as Record<string, unknown>) || {};

    const records = await this.learningRecordService.findByUser(userId);
    const learningSkills = await Promise.all(
      records
        .filter((r) => r.status !== LearningStatus.ABANDONED)
        .map(async (r) => {
          // 树为私有资源：传入 userId 触发归属校验（非本人的树会抛 Forbidden 并被 catch 忽略）
          const tree = await this.skillTreeService.findById(r.skillTreeId, userId).catch(() => null);
          return {
            name: tree?.name || '',
            type: tree?.type || '',
            description: tree?.description,
          };
        }),
    );

    const oldRecs = await this.recommendationRepo.find({
      where: { userId, isActive: true },
      order: { sortOrder: 'ASC' },
    });

    const result = await this.aiService.generateRecommendations(
      {
        portrait,
        learningSkills: learningSkills.filter((s) => s.name),
        oldRecommendations: oldRecs.map((r) => ({ title: r.title, reason: r.reason })),
      },
      { userId },
    );

    const now = new Date();
    const expireAt = new Date();
    expireAt.setDate(now.getDate() + RECOMMENDATION_TTL_DAYS);

    // 「作废旧推荐 + 写入新推荐」必须在同一事务里：
    // 分两步执行时，save 失败会让用户一条 active 推荐都不剩
    return this.dataSource.transaction(async (manager) => {
      const txRepo = manager.getRepository(Recommendation);

      await txRepo.update({ userId, isActive: true }, { isActive: false });

      const recommendations = (result.recommendations || [])
        .slice(0, MAX_RECOMMENDATIONS)
        .map((item, index) =>
          txRepo.create({
            userId,
            title: item.title,
            description: item.description,
            reason: item.reason,
            matchTags: Array.isArray(item.matchTags) ? item.matchTags : [],
            suggestedMode: item.suggestedMode,
            keywords: Array.isArray(item.keywords) ? item.keywords : [],
            source: RecommendationSource.AI_GENERATED,
            isActive: true,
            sortOrder: index,
            createdAt: now,
            expireAt,
          }),
        );

      return txRepo.save(recommendations);
    });
  }

  async createSkillTreeFromRecommendation(
    userId: string,
    recommendationId: string,
    type?: string,
    selectedPoints?: string[],
  ) {
    const recommendation = await this.recommendationRepo.findOne({
      where: { id: recommendationId, userId },
    });
    if (!recommendation) {
      throw new NotFoundException('Recommendation not found');
    }

    const tree = await this.skillTreeService.create(
      {
        name: recommendation.title,
        description: recommendation.description,
        type: (type as TreeType) || TreeType.ENTRY,
        keywords: recommendation.keywords?.join('，'),
        selectedPoints,
      },
      userId,
    );

    recommendation.skillTreeId = tree.id;
    await this.recommendationRepo.save(recommendation);

    return tree;
  }
}
