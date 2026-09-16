import { databaseConfig } from './database.config';

describe('databaseConfig', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('关闭 synchronize（schema 变更只能走 migration）', () => {
    expect(databaseConfig().synchronize).toBe(false);
  });

  it('在 production 下同样关闭 synchronize', () => {
    process.env.NODE_ENV = 'production';
    expect(databaseConfig().synchronize).toBe(false);
  });

  it('显式注册实体（不使用 glob）', () => {
    const entities = databaseConfig().entities as unknown[];
    expect(Array.isArray(entities)).toBe(true);
    expect(entities.length).toBeGreaterThan(0);
  });
});
