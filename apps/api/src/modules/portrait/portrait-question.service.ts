import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PortraitQuestionCategory } from '@skill/shared';
import { PortraitQuestion } from './entities/portrait-question.entity';
import { PORTRAIT_QUESTIONS_SEED } from '../../seeds/portrait-questions.seed';

@Injectable()
export class PortraitQuestionService implements OnModuleInit {
  constructor(
    @InjectRepository(PortraitQuestion)
    private questionRepo: Repository<PortraitQuestion>,
  ) {}

  async onModuleInit() {
    const count = await this.questionRepo.count();
    if (count === 0) {
      const questions = PORTRAIT_QUESTIONS_SEED.map((q, index) =>
        this.questionRepo.create({
          ...q,
          sortOrder: index,
        }),
      );
      await this.questionRepo.save(questions);
    }
  }

  async findActiveGrouped(): Promise<{
    categories: string[];
    questions: PortraitQuestion[];
  }> {
    const questions = await this.questionRepo.find({
      where: { active: true },
      order: { sortOrder: 'ASC' },
    });

    const categories = Array.from(
      new Set(questions.map((q) => q.category)),
    ) as string[];

    return { categories, questions };
  }

  async findByIds(ids: string[]): Promise<PortraitQuestion[]> {
    return this.questionRepo.find({
      where: { id: In(ids), active: true },
      order: { sortOrder: 'ASC' },
    });
  }
}
