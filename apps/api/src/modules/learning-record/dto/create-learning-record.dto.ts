import { IsUUID } from 'class-validator';

/** POST /learning-records 的白名单入参（原为裸 TS 类型 { skillTreeId: string }） */
export class CreateLearningRecordDto {
  @IsUUID()
  skillTreeId: string;
}
