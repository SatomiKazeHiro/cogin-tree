import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { PortraitQuestionService } from './portrait-question.service';
import { AiIntegrationService } from '../ai-integration/ai-integration.service';
import { PortraitQuestionCategory } from '@skill/shared';

@Injectable()
export class PortraitAIService {
  constructor(
    private userService: UserService,
    private questionService: PortraitQuestionService,
    private aiService: AiIntegrationService,
  ) {}

  async generatePortrait(userId: string, answers: { questionId: string; selectedOptions: string[] }[]) {
    const questions = await this.questionService.findByIds(
      answers.map((a) => a.questionId),
    );

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

    const portrait = await this.aiService.generatePortrait({
      identityAnswers: grouped[PortraitQuestionCategory.IDENTITY],
      interestAnswers: grouped[PortraitQuestionCategory.INTEREST],
      goalAnswers: grouped[PortraitQuestionCategory.GOAL],
      backgroundAnswers: grouped[PortraitQuestionCategory.BACKGROUND],
    });

    await this.userService.updateProfile(userId, {
      computedPortrait: portrait,
      portraitUpdatedAt: new Date(),
    });

    return portrait;
  }
}
