import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InterviewService } from './interview.service';
import { InterviewController } from './interview.controller';
import { InterviewQuestion } from './entities/interview-question.entity';
import { SkillTreeModule } from '../skill-tree/skill-tree.module';
import { AiIntegrationModule } from '../ai-integration/ai-integration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InterviewQuestion]),
    SkillTreeModule,
    AiIntegrationModule,
  ],
  controllers: [InterviewController],
  providers: [InterviewService],
})
export class InterviewModule {}
