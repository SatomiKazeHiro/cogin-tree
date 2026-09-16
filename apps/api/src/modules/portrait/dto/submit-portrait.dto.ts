import { Type } from 'class-transformer';
import { IsArray, IsString, IsUUID, ValidateNested } from 'class-validator';

/**
 * 单条问卷答案。
 *
 * 之前 SubmitPortraitDto 只写了 `@IsArray() answers`，**数组元素完全没有校验**，
 * 于是形状错误的载荷（例如 questionId 缺失）能一路走到数据库才报 NOT NULL 错误 ——
 * 而那时 AI 已经调用过了，token 已经花掉。这里补上嵌套校验，让坏载荷在调用 AI 之前就 400。
 */
export class PortraitAnswerDto {
  @IsUUID()
  questionId: string;

  @IsArray()
  @IsString({ each: true })
  selectedOptions: string[];
}

export class SubmitPortraitDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PortraitAnswerDto)
  answers: PortraitAnswerDto[];
}
