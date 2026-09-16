import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * PATCH /nodes/:id/content 的白名单入参。
 * 取代原来的裸 TS 类型 { coreText?: string }：裸类型无 class-validator 元数据，
 * ValidationPipe 的 whitelist 无效，客户端可借机改 node_id 等内部列（mass assignment）。
 */
export class UpdateNodeContentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  coreText?: string;
}
