import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { TreeType } from '@skill/shared';

export class GenerateKnowledgePointsDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(TreeType)
  type: TreeType;

  @IsOptional()
  @IsString()
  keywords?: string;
}
