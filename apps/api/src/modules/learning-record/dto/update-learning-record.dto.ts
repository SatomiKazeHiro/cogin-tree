import { IsEnum } from 'class-validator';
import { LearningStatus } from '@skill/shared';

export class UpdateLearningRecordDto {
  @IsEnum(LearningStatus)
  status: LearningStatus;
}
