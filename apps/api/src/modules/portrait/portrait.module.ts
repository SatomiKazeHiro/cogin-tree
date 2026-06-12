import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module';
import { AiIntegrationModule } from '../ai-integration/ai-integration.module';
import { PortraitQuestion } from './entities/portrait-question.entity';
import { PortraitAnswer } from './entities/portrait-answer.entity';
import { PortraitQuestionService } from './portrait-question.service';
import { PortraitAIService } from './portrait-ai.service';
import { PortraitController } from './portrait.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PortraitQuestion, PortraitAnswer]),
    UserModule,
    AiIntegrationModule,
  ],
  providers: [PortraitQuestionService, PortraitAIService],
  controllers: [PortraitController],
})
export class PortraitModule {}
