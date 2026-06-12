import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { TreeType } from '@skill/shared';

export class CreateSkillTreeDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(TreeType)
  type: TreeType;
}
