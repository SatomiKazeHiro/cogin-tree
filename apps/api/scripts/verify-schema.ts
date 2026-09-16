/**
 * 目标 schema 断言（阶段 1 验收测试）。
 *
 * 用法：cd apps/api; node_modules\.bin\ts-node scripts/verify-schema.ts
 * 设计依据：docs/specs/2026-09-16-ai-contract-and-dataflow-design.md 第 5 节
 *
 * 注意：本文件不在 tsconfig 的 include（仅 src/**）内，`tsc --noEmit` 不检查它，
 * 正确性只能靠实际运行验证。
 */
import { join } from 'node:path';
import { loadFirstExistingEnvFile } from '../src/config/load-env';

/**
 * 本仓库未安装 @types/pg（不为一个验证脚本新增依赖）。
 * 这里声明 Client 的最小形状，既满足 noImplicitAny，又能在调用点获得类型推导。
 */
type PgClient = {
  connect(): Promise<void>;
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  end(): Promise<void>;
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require('pg') as { Client: new (config: Record<string, unknown>) => PgClient };

loadFirstExistingEnvFile([
  join(__dirname, '../../.env'),
  join(process.cwd(), '.env'),
  join(process.cwd(), '../../.env'),
]);

/** 17 张目标表 */
const EXPECTED_TABLES = [
  'ai_generations',
  'analysis_jobs',
  'code_examples',
  'exercises',
  'generation_tasks',
  'interview_questions',
  'learning_records',
  'node_contents',
  'node_learning_records',
  'portrait_answers',
  'portrait_questions',
  'recommendations',
  'skill_trees',
  'suggested_changes',
  'tree_nodes',
  'user_profiles',
  'users',
];

/** synchronize 只加不删留下的死表 */
const FORBIDDEN_TABLES = ['global_configs', 'recommendation_jobs'];

/**
 * TypeORM 自身的书签表，不属于业务 schema，但必须存在（我们在用 migration）。
 * 不做排除的话，表集合断言会把它当成多余表而永远失败。
 */
const TOOLING_TABLES = ['migrations'];

/** 7 处 varchar 存 UUID 的列，必须为 uuid */
const UUID_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ['learning_records', 'user_id'],
  ['learning_records', 'skill_tree_id'],
  ['node_learning_records', 'user_id'],
  ['node_learning_records', 'skill_tree_id'],
  ['node_learning_records', 'node_id'],
  ['recommendations', 'user_id'],
  ['suggested_changes', 'parent_node_id'],
  ['suggested_changes', 'target_node_id'],
];

/** 必须为 ON DELETE CASCADE 的外键（confdeltype = 'c'） */
const CASCADE_FKS: ReadonlyArray<readonly [string, string]> = [
  ['tree_nodes', 'tree_id'],
  ['tree_nodes', 'parent_id'],
  ['node_contents', 'node_id'],
  ['code_examples', 'node_content_id'],
  ['exercises', 'node_content_id'],
  ['learning_records', 'skill_tree_id'],
  ['node_learning_records', 'node_id'],
  ['interview_questions', 'l2_node_id'],
];

/** 必须存在的唯一约束（列集合，顺序无关） */
const UNIQUE_CONSTRAINTS: ReadonlyArray<readonly [string, string[]]> = [
  ['learning_records', ['user_id', 'skill_tree_id']],
  ['node_learning_records', ['user_id', 'node_id']],
  ['generation_tasks', ['node_id', 'artifact_kind']],
  ['node_contents', ['node_id']],
];

/**
 * 非唯一索引的目标数量（对应设计文档 5.3 的索引清单）。
 * 逐项来源：skill_trees(owner_id)、tree_nodes(parent_id)/(tree_id,level)、code_examples(node_content_id)、
 * exercises(node_content_id)、learning_records(user_id)/(skill_tree_id)、
 * node_learning_records(node_id)/(user_id,skill_tree_id)、recommendations(user_id,is_active)、
 * interview_questions(tree_id)/(l2_node_id)、analysis_jobs(tree_id)、
 * suggested_changes(job_id)/(status)、generation_tasks(status)、
 * ai_generations(created_at)/(stage,created_at)/(tree_id,created_at) = 19
 *
 * 注意：这是对阶段 1 schema 的精确断言，后续阶段若有意增删索引需同步更新此常量。
 */
const EXPECTED_NON_UNIQUE_INDEXES = 19;

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'skill_learning',
  });
  await client.connect();

  const failures: string[] = [];
  const check = (ok: boolean, label: string) => {
    if (!ok) failures.push(label);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  };

  // 1. 表集合（排除 TypeORM 书签表后必须恰好等于目标域表集合）
  const { rows: tables } = await client.query<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'`,
  );
  const allNames = tables.map((t) => t.table_name).sort();
  const names = allNames.filter((n) => !TOOLING_TABLES.includes(n));
  check(
    JSON.stringify(names) === JSON.stringify([...EXPECTED_TABLES].sort()),
    `域表集合 == 17 张目标表（实际 ${names.length} 张，已排除工具表）`,
  );
  for (const tooling of TOOLING_TABLES) {
    check(allNames.includes(tooling), `迁移书签表存在：${tooling}`);
  }
  for (const dead of FORBIDDEN_TABLES) {
    check(!names.includes(dead), `死表已删除：${dead}`);
  }

  // 2. 类型
  for (const [table, column] of UUID_COLUMNS) {
    const { rows } = await client.query<{ data_type: string }>(
      `select data_type from information_schema.columns
        where table_schema = 'public' and table_name = $1 and column_name = $2`,
      [table, column],
    );
    check(rows[0]?.data_type === 'uuid', `${table}.${column} 为 uuid（实际 ${rows[0]?.data_type ?? '列不存在'}）`);
  }

  // 3. 级联
  for (const [table, column] of CASCADE_FKS) {
    const { rows } = await client.query<{ confdeltype: string }>(
      `select c.confdeltype
         from pg_constraint c
         join pg_class rel on rel.oid = c.conrelid
         join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
        where c.contype = 'f' and rel.relname = $1 and a.attname = $2`,
      [table, column],
    );
    check(rows[0]?.confdeltype === 'c', `${table}.${column} 外键 ON DELETE CASCADE（实际 ${rows[0]?.confdeltype ?? '无外键'}）`);
  }

  // 4. 唯一约束
  for (const [table, columns] of UNIQUE_CONSTRAINTS) {
    const { rows } = await client.query<{ cols: string }>(
      `select string_agg(a.attname, ',' order by a.attname) as cols
         from pg_constraint c
         join pg_class rel on rel.oid = c.conrelid
         join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
        where c.contype = 'u' and rel.relname = $1
        group by c.conname`,
      [table],
    );
    const wanted = [...columns].sort().join(',');
    check(rows.some((r) => r.cols === wanted), `${table} 唯一约束 (${wanted})`);
  }

  // 5. 不允许残留 NO ACTION 外键（删父行必须要么 CASCADE 要么 SET NULL，否则运行期必报 500）
  const { rows: noAction } = await client.query<{ tbl: string; col: string }>(
    `select conrelid::regclass::text as tbl, a.attname as col
       from pg_constraint c
       join unnest(c.conkey) k on true
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
      where c.contype = 'f' and c.confdeltype = 'a'`,
  );
  check(
    noAction.length === 0,
    `无 NO ACTION 外键（实际 ${noAction.length} 个${noAction.length ? '：' + noAction.map((r) => `${r.tbl}.${r.col}`).join(', ') : ''}）`,
  );

  // 6. 索引数量
  const { rows: idx } = await client.query<{ n: string }>(
    `select count(*) as n from pg_indexes
      where schemaname = 'public' and indexdef not like '%UNIQUE%'`,
  );
  check(
    Number(idx[0].n) === EXPECTED_NON_UNIQUE_INDEXES,
    `非唯一索引数量 == ${EXPECTED_NON_UNIQUE_INDEXES}（实际 ${idx[0].n}）`,
  );

  await client.end();

  if (failures.length > 0) {
    console.error(`\n${failures.length} 项断言失败：`);
    for (const f of failures) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  }
  console.log('\nSCHEMA OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
