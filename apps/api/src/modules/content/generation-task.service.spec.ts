import { GenerationTaskService, STALE_GENERATING_MS } from './generation-task.service';
import { ArtifactKind } from '@skill/shared';
import { GenerationTask } from './entities/generation-task.entity';

describe('GenerationTaskService', () => {
  let service: GenerationTaskService;
  let dataSource: { query: jest.Mock };
  let taskRepo: { update: jest.Mock; find: jest.Mock };
  let manager: { query: jest.Mock };

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    taskRepo = { update: jest.fn(), find: jest.fn() };
    manager = { query: jest.fn() };
    service = new GenerationTaskService(dataSource as never, taskRepo as never);
  });

  it('抢到任务（INSERT 成功）返回 fencing token', async () => {
    dataSource.query.mockResolvedValue([{ claim_token: '2026-09-25 10:00:00.123456' }]);

    await expect(service.claim('n1', ArtifactKind.L3_CORE_TEXT)).resolves.toBe(
      '2026-09-25 10:00:00.123456',
    );
    expect(dataSource.query).toHaveBeenCalledTimes(1);
    const sql = dataSource.query.mock.calls[0][0] as string;
    expect(sql).toContain('on conflict (node_id, artifact_kind) do update');
    // 只有 PENDING / FAILED / 陈旧 GENERATING 才允许认领，READY 绝不能被抢走
    expect(sql).toContain("status in ('PENDING', 'FAILED')");
    expect(sql).toContain('interval');
    // token 取自本次认领写入的 started_at（文本形式保证微秒精度无损往返）
    expect(sql).toContain('returning started_at::text as claim_token');
  });

  it('抢不到（他人正在生成或已 READY）返回 null', async () => {
    dataSource.query.mockResolvedValue([]);
    await expect(service.claim('n1', ArtifactKind.L3_EXERCISES)).resolves.toBeNull();
  });

  it('陈旧阈值是 120 秒（传给 SQL）', async () => {
    dataSource.query.mockResolvedValue([]);
    await service.claim('n1', ArtifactKind.L3_CORE_TEXT);

    const params = dataSource.query.mock.calls[0][1] as unknown[];
    expect(params).toContain(STALE_GENERATING_MS);
    expect(STALE_GENERATING_MS).toBe(120_000);
  });

  it('markReady：token 匹配时在同一事务里写入状态、版本、模型与结束时间', async () => {
    manager.query.mockResolvedValue([{ id: 'task-1' }]);

    const ok = await service.markReady(
      manager as never,
      'n1',
      ArtifactKind.L3_CORE_TEXT,
      'tok-1',
      { promptVersion: '1.0.0', model: 'deepseek-flash' },
    );

    expect(ok).toBe(true);
    const [sql, params] = manager.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("status = 'READY'");
    expect(sql).toContain('prompt_version');
    expect(sql).toContain('finished_at');
    // fencing：只有持有本次认领的写者才能标记 READY
    expect(sql).toContain('started_at = $3::timestamp');
    expect(params).toEqual(['n1', ArtifactKind.L3_CORE_TEXT, 'tok-1', '1.0.0', 'deepseek-flash']);
  });

  it('markReady：token 不匹配（认领已被回收）返回 false，一行都不改', async () => {
    manager.query.mockResolvedValue([]);

    const ok = await service.markReady(
      manager as never,
      'n1',
      ArtifactKind.L3_CORE_TEXT,
      'stale-token',
      { promptVersion: '1.0.0' },
    );

    expect(ok).toBe(false);
  });

  it('markFailed 写入 FAILED 与错误摘要（截断到 1000 字），且带 fencing 条件', async () => {
    await service.markFailed('n1', ArtifactKind.L3_EXERCISES, 'tok-1', 'x'.repeat(1500));

    const [sql, params] = dataSource.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("status = 'FAILED'");
    expect(sql).toContain('started_at = $3::timestamp');
    expect(params[1]).toBe(ArtifactKind.L3_EXERCISES);
    expect(params[2]).toBe('tok-1');
    expect((params[3] as string).length).toBe(1000);
  });

  it('findForNode 按 kind 返回', async () => {
    taskRepo.find.mockResolvedValue([{ nodeId: 'n1' } as GenerationTask]);
    await expect(service.findForNode('n1')).resolves.toHaveLength(1);
    expect(taskRepo.find).toHaveBeenCalledWith({ where: { nodeId: 'n1' } });
  });

  // ── 阶段 5：force 认领（重新生成的地基） ──────────────────────────

  it('force=true 时允许从 READY 重新认领', async () => {
    dataSource.query.mockResolvedValue([{ claim_token: 'tok-force' }]);

    await expect(service.claim('n1', ArtifactKind.L3_CORE_TEXT, true)).resolves.toBe('tok-force');

    const sql = dataSource.query.mock.calls[0][0] as string;
    const params = dataSource.query.mock.calls[0][1] as unknown[];
    // READY 分支由 $4 开关控制：默认关闭，force 时打开
    expect(sql).toContain("and generation_tasks.status = 'READY'");
    expect(params).toContain(true);
  });

  it('force 缺省时参数为 false（行为与阶段 4 一致）', async () => {
    dataSource.query.mockResolvedValue([]);

    await service.claim('n1', ArtifactKind.L3_CORE_TEXT);

    const params = dataSource.query.mock.calls[0][1] as unknown[];
    expect(params).toContain(false);
    expect(params).toContain(STALE_GENERATING_MS);
  });

  it('他人正在生成（新鲜 GENERATING）时 force 也抢不到——保持单写者', async () => {
    dataSource.query.mockResolvedValue([]);

    await expect(service.claim('n1', ArtifactKind.L3_EXERCISES, true)).resolves.toBeNull();
  });
});
