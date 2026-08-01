import { IsArray } from 'class-validator';

export class SubmitPortraitDto {
  @IsArray()
  answers: {
    questionId: string;
    selectedOptions: string[];
  }[];
}
