import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { AiIntegrationService } from './ai-integration.service';

@Module({
  imports: [ConfigModule],
  providers: [AiIntegrationService],
  exports: [AiIntegrationService],
})
export class AiIntegrationModule {}
