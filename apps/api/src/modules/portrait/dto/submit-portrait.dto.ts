import { IsArray, IsString, IsUUID, IsNotEmpty } from 'class-validator';

export class SubmitPortraitDto {
  @IsArray()
  answers: {
    questionId: string;
    selectedOptions: string[];
  }[];
}

export class PortraitAnswerItemDto {
  @IsUUID()
  @IsNotEmpty()
  questionId: string;

  @IsArray()
  @IsString({ each: true })
  selectedOptions: string[];
}
