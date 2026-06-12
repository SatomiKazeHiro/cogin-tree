import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningRecord } from './entities/learning-record.entity';
import { LearningRecordService } from './learning-record.service';
import { LearningRecordController } from './learning-record.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LearningRecord])],
  providers: [LearningRecordService],
  controllers: [LearningRecordController],
  exports: [LearningRecordService],
})
export class LearningRecordModule {}
