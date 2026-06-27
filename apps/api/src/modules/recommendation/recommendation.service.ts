import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LearningStatus,
  RecommendationSource,
} from '@skill/shared';
import { Recommendation } from './entities/recommendation.entity';
import { UserService } from '../user/user.service';
import { LearningRecordService } from '../learning-record/learning-record.service';
import { SkillTreeService } from '../skill-tree/skill-tree.service';
import { AiIntegrationService } from '../ai-integration/ai-integration.service';

const RECOMMENDATION_TTL_DAYS = 3;
const MAX_RECOMMENDATIONS = 10;

@Injectable()
export class RecommendationService {
  private generating = new Map<string, Promise<Recommendation[]>>();

  constructor(
    @InjectRepository(Recommendation)
    private recommendationRepo: Repository<Recommendation>,
    private userService: UserService,
    private learningRecordService: LearningRecordService,
    private skillTreeService: SkillTreeService,
    private aiService: AiIntegrationService,
  ) {}

  async findForUser(userId: string): Promise<Recommendation[]> {
    const active = await this.findActiveByUser(userId);

    if (active.length > 0 && active.every((r) => r.expireAt && r.expireAt > new Date())) {
      return active;
    }

    return this.refreshForUser(userId);
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
          const tree = await this.skillTreeService.findById(r.skillTreeId).catch(() => null);
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

    const result = await this.aiService.generateRecommendations({
      portrait,
      learningSkills: learningSkills.filter((s) => s.name),
      oldRecommendations: oldRecs.map((r) => ({ title: r.title, reason: r.reason })),
    });

    const now = new Date();
    const expireAt = new Date();
    expireAt.setDate(now.getDate() + RECOMMENDATION_TTL_DAYS);

    await this.recommendationRepo.update(
      { userId, isActive: true },
      { isActive: false },
    );

    const recommendations = (result.recommendations || [])
      .slice(0, MAX_RECOMMENDATIONS)
      .map((item, index) =>
        this.recommendationRepo.create({
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

    return this.recommendationRepo.save(recommendations);
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
      throw new Error('Recommendation not found');
    }

    const tree = await this.skillTreeService.create(
      {
        name: recommendation.title,
        description: recommendation.description,
        type: (type as any) || 'ENTRY',
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
