import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PromptManager } from '@skill/prompt-manager';
import { PortraitQuestionService } from './portrait-question.service';
import { AiIntegrationService } from '../ai-integration/ai-integration.service';
import { PortraitAnswer } from './entities/portrait-answer.entity';
import { UserProfile } from '../user/entities/user-profile.entity';
import { PortraitQuestionCategory } from '@skill/shared';

@Injectable()
export class PortraitAIService {
  constructor(
    private questionService: PortraitQuestionService,
    private aiService: AiIntegrationService,
    private dataSource: DataSource,
  ) {}

  /**
   * 先算后落库：
   * ① 组装答案上下文并调 AI（不动数据库）
   * ② 单事务替换问卷答案 + 更新画像 + 记录契约版本
   *
   * 原实现先替换答案再调 AI，AI 失败会留下「答案已换、画像还是旧的」的不一致状态；
   * 现在两者要么一起成功、要么都不动。
   */
  async generatePortrait(
    userId: string,
    answers: { questionId: string; selectedOptions: string[] }[],
  ) {
    const questions = await this.questionService.findByIds(
      answers.map((a) => a.questionId),
    );

    // ① 先算
    const grouped: Record<PortraitQuestionCategory, string[]> = {
      [PortraitQuestionCategory.IDENTITY]: [],
      [PortraitQuestionCategory.INTEREST]: [],
      [PortraitQuestionCategory.GOAL]: [],
      [PortraitQuestionCategory.BACKGROUND]: [],
    };

    for (const answer of answers) {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) continue;
      const selectedText = answer.selectedOptions.map(
        (opt) => question.options.find((o) => o === opt) || opt,
      );
      grouped[question.category].push(`${question.question}: ${selectedText.join(', ')}`);
    }

    const portrait = await this.aiService.generatePortrait(
      {
        identityAnswers: grouped[PortraitQuestionCategory.IDENTITY],
        interestAnswers: grouped[PortraitQuestionCategory.INTEREST],
        goalAnswers: grouped[PortraitQuestionCategory.GOAL],
        backgroundAnswers: grouped[PortraitQuestionCategory.BACKGROUND],
      },
      { userId },
    );

    // ② 后落库（单事务）
    await this.dataSource.transaction(async (manager) => {
      const profileRepo = manager.getRepository(UserProfile);
      const profile = await profileRepo.findOne({ where: { userId } });
      if (!profile) {
        return;
      }

      const answerRepo = manager.getRepository(PortraitAnswer);
      await answerRepo.delete({ profileId: profile.id });
      if (answers.length > 0) {
        await answerRepo.save(
          answers.map((a) =>
            answerRepo.create({
              profileId: profile.id,
              questionId: a.questionId,
              selectedOptions: a.selectedOptions,
            }),
          ),
        );
      }

      await profileRepo.update(
        { userId },
        {
          computedPortrait: { ...portrait },
          portraitUpdatedAt: new Date(),
          // 记录生成该画像所用的契约版本，便于日后判断是否需要重生成
          portraitSchemaVersion: PromptManager.versionOf('portrait'),
        },
      );
    });

    return portrait;
  }
}
