import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from '../user/user.service';
import { PortraitQuestionService } from './portrait-question.service';
import { AiIntegrationService } from '../ai-integration/ai-integration.service';
import { PortraitAnswer } from './entities/portrait-answer.entity';
import { PortraitQuestionCategory } from '@skill/shared';

@Injectable()
export class PortraitAIService {
  constructor(
    private userService: UserService,
    private questionService: PortraitQuestionService,
    private aiService: AiIntegrationService,
    @InjectRepository(PortraitAnswer)
    private answerRepo: Repository<PortraitAnswer>,
  ) {}

  async generatePortrait(userId: string, answers: { questionId: string; selectedOptions: string[] }[]) {
    const questions = await this.questionService.findByIds(
      answers.map((a) => a.questionId),
    );

    // Persist the raw answers (replacing previous ones) so the portrait can
    // be regenerated or audited later.
    await this.saveAnswers(userId, answers);

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

    await this.userService.updateProfile(userId, {
      computedPortrait: portrait,
      portraitUpdatedAt: new Date(),
    });

    return portrait;
  }

  private async saveAnswers(
    userId: string,
    answers: { questionId: string; selectedOptions: string[] }[],
  ): Promise<void> {
    const profile = await this.userService.getProfile(userId);
    if (!profile) return;

    await this.answerRepo.delete({ profileId: profile.id });
    const rows = answers.map((a) =>
      this.answerRepo.create({
        profileId: profile.id,
        questionId: a.questionId,
        selectedOptions: a.selectedOptions,
      }),
    );
    await this.answerRepo.save(rows);
  }
}
