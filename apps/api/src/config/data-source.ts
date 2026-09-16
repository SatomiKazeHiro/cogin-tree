import 'reflect-metadata';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { databaseConfig } from './database.config';
import { loadFirstExistingEnvFile } from './load-env';

/**
 * TypeORM CLI 入口（migration:generate / migration:run / migration:revert）。
 *
 * 与 Nest 运行时不同，CLI 不经过 @nestjs/config，因此这里显式加载根 .env；
 * 已有环境变量优先（loadFirstExistingEnvFile 不覆盖已有值）。
 */
loadFirstExistingEnvFile([
  join(__dirname, '../../../.env'),
  join(__dirname, '../../.env'),
  join(process.cwd(), '.env'),
  join(process.cwd(), '../../.env'),
]);

type PostgresOptions = {
  type: 'postgres';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  entities?: unknown;
  migrations?: unknown;
};

const options = databaseConfig() as PostgresOptions;

export default new DataSource({
  type: 'postgres',
  host: options.host,
  port: options.port,
  username: options.username,
  password: options.password,
  database: options.database,
  entities: (options.entities ?? []) as never,
  migrations: (options.migrations ?? []) as never,
  // CLI 永远不应启用 synchronize
  synchronize: false,
});
