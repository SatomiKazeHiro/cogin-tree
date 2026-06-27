import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { UserModule } from '../user/user.module';
import { LearningRecordModule } from '../learning-record/learning-record.module';
import { SkillTreeModule } from '../skill-tree/skill-tree.module';

@Module({
  imports: [
    UserModule,
    LearningRecordModule,
    SkillTreeModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
