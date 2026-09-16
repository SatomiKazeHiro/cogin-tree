import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiIntegrationService } from './ai-integration.service';
import { AiGenerationService } from './ai-generation.service';
import { AiGeneration } from './entities/ai-generation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AiGeneration])],
  providers: [AiIntegrationService, AiGenerationService],
  exports: [AiIntegrationService],
})
export class AiIntegrationModule {}
