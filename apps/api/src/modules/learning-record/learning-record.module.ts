import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TreeAccessModule } from '../tree-access/tree-access.module';
import { LearningRecord } from './entities/learning-record.entity';
import { LearningRecordService } from './learning-record.service';
import { LearningRecordController } from './learning-record.controller';
import { NodeLearningRecord } from './entities/node-learning-record.entity';
import { NodeLearningRecordService } from './node-learning-record.service';
import { NodeLearningRecordController } from './node-learning-record.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([LearningRecord, NodeLearningRecord]),
    TreeAccessModule,
  ],
  providers: [LearningRecordService, NodeLearningRecordService],
  controllers: [LearningRecordController, NodeLearningRecordController],
  exports: [LearningRecordService, NodeLearningRecordService],
})
export class LearningRecordModule {}
