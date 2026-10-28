import { RecommendationService } from './recommendation.service';
import { Recommendation } from './entities/recommendation.entity';

describe('RecommendationService.findForUser（TTL 与后台刷新）', () => {
  let service: RecommendationService;
  let repo: { find: jest.Mock };

  const userId = 'user-1';

  const rec = (overrides: Partial<Recommendation>): Recommendation =>
    ({
      id: 'rec-1',
      userId,
      title: '方向',
      isActive: true,
      sortOrder: 0,
      ...overrides,
    }) as Recommendation;

  beforeEach(() => {
    repo = { find: jest.fn() };
    service = new RecommendationService(
      { transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb({})) } as never,
      repo as never,
      { getProfile: jest.fn() } as never,
      { findByUser: jest.fn() } as never,
      { findById: jest.fn() } as never,
      { generateRecommendations: jest.fn() } as never,
    );
  });

  it('无任何推荐时：阻塞式生成并返回结果', async () => {
    repo.find.mockResolvedValue([]);
    const fresh = [rec({ id: 'new-1' })];
    const refreshSpy = jest
      .spyOn(service, 'refreshForUser')
      .mockResolvedValue(fresh);

    const result = await service.findForUser(userId);

    expect(result).toBe(fresh);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('推荐全部未过期时：直接返回，不触发刷新', async () => {
    const valid = [
      rec({ id: 'a', expireAt: new Date(Date.now() + 86400_000) }),
      rec({ id: 'b', expireAt: new Date(Date.now() + 86400_000) }),
    ];
    repo.find.mockResolvedValue(valid);
    const refreshSpy = jest.spyOn(service, 'refreshForUser');

    const result = await service.findForUser(userId);

    expect(result).toBe(valid);
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('推荐已过期时：立即返回旧数据，并触发后台刷新', async () => {
    const stale = [rec({ id: 'old', expireAt: new Date(Date.now() - 1000) })];
    repo.find.mockResolvedValue(stale);
    const fresh = [rec({ id: 'new' })];
    const refreshSpy = jest
      .spyOn(service, 'refreshForUser')
      .mockResolvedValue(fresh);

    const result = await service.findForUser(userId);

    // 同步返回旧数据，不等待后台刷新完成
    expect(result).toBe(stale);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('后台刷新失败时：旧数据照常返回，不向上抛错', async () => {
    const stale = [rec({ id: 'old', expireAt: new Date(Date.now() - 1000) })];
    repo.find.mockResolvedValue(stale);
    jest
      .spyOn(service, 'refreshForUser')
      .mockRejectedValue(new Error('AI 调用失败'));

    const result = await service.findForUser(userId);

    expect(result).toBe(stale);
    // 让后台 promise 的 catch 跑完，确认无未处理异常
    await new Promise((resolve) => setImmediate(resolve));
  });

  describe('generateForUser（事务性刷新）', () => {
    const buildService = (txRepo: unknown, transactionImpl?: jest.Mock) => {
      const dataSource = {
        transaction:
          transactionImpl ??
          jest.fn(async (cb: (m: unknown) => unknown) =>
            cb({ getRepository: () => txRepo }),
          ),
      };
      return new RecommendationService(
        dataSource as never,
        repo as never, // 旧推荐标题去重的读取仍走注入的 repo
        { getProfile: jest.fn(async () => null) } as never,
        { findByUser: jest.fn(async () => []) } as never,
        { findById: jest.fn() } as never,
        {
          generateRecommendations: jest.fn(async () => ({
            recommendations: [{ title: 'T', description: 'd', reason: 'r' }],
          })),
        } as never,
      );
    };

    it('作废旧推荐与写入新推荐在同一事务里执行', async () => {
      const txRepo = {
        update: jest.fn(async () => undefined),
        create: jest.fn((v) => v),
        save: jest.fn(async (rows) => rows),
      };
      const svc = buildService(txRepo);
      repo.find.mockResolvedValue([]); // oldRecs

      const saved = await svc.generateForUser(userId);

      expect(txRepo.update).toHaveBeenCalledWith(
        { userId, isActive: true },
        { isActive: false },
      );
      expect(txRepo.save).toHaveBeenCalledTimes(1);
      expect(saved).toHaveLength(1);
    });

    it('事务失败向外抛错：作废操作随事务回滚，不会留下「零推荐」状态', async () => {
      const transaction = jest.fn(async () => {
        throw new Error('DB down');
      });
      const svc = buildService(null, transaction);
      repo.find.mockResolvedValue([]);

      await expect(svc.generateForUser(userId)).rejects.toThrow('DB down');
      // 不存在事务外的单独作废写
      expect(repo.find).toHaveBeenCalledTimes(1); // 仅 oldRecs 读取
    });
  });
});
