import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { databaseConfig } from './config/database.config';
import { HealthController } from './health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { AiIntegrationModule } from './modules/ai-integration/ai-integration.module';
import { PortraitModule } from './modules/portrait/portrait.module';
import { SkillTreeModule } from './modules/skill-tree/skill-tree.module';
import { TreeNodeModule } from './modules/tree-node/tree-node.module';
import { ContentModule } from './modules/content/content.module';
import { LearningRecordModule } from './modules/learning-record/learning-record.module';
import { RecommendationModule } from './modules/recommendation/recommendation.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { InterviewModule } from './modules/interview/interview.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    TypeOrmModule.forRoot(databaseConfig()),
    AuthModule,
    UserModule,
    AiIntegrationModule,
    PortraitModule,
    SkillTreeModule,
    TreeNodeModule,
    ContentModule,
    LearningRecordModule,
    RecommendationModule,
    DashboardModule,
    InterviewModule,
    AnalysisModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
