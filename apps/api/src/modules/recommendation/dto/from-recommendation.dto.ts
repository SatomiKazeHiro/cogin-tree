import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TreeType } from '@skill/shared';

/** POST /recommendations/from-recommendation 的白名单入参 */
export class FromRecommendationDto {
  @IsUUID()
  recommendationId: string;

  @IsOptional()
  @IsEnum(TreeType)
  type?: TreeType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedPoints?: string[];
}
