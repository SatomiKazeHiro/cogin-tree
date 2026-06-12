import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { AIProviderType } from '@skill/shared';

export class AIConfigDto {
  @IsEnum(AIProviderType)
  provider: AIProviderType;

  @IsString()
  apiKey: string;

  @IsString()
  model: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  baseUrl?: string;
}
