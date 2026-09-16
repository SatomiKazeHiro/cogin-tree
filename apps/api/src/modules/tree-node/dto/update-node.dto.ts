import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * PATCH /nodes/:id 的白名单入参。
 * 取代原先的裸 TS 类型 Partial<{ title; description }>——裸类型没有 class-validator 元数据，
 * ValidationPipe 的 whitelist 对它无效，客户端可借机改 treeId/level/parentId（mass assignment）。
 */
export class UpdateNodeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
