import { IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  selectedPoints?: string[];

  @IsOptional()
  @IsString()
  keywords?: string;
}
