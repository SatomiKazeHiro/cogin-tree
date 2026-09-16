import { GenerationTaskService, STALE_GENERATING_MS } from './generation-task.service';
import { ArtifactKind, GenerationTaskStatus } from '@skill/shared';
import { GenerationTask } from './entities/generation-task.entity';

describe('GenerationTaskService', () => {
  let service: GenerationTaskService;
  let dataSource: { query: jest.Mock };
  let taskRepo: { update: jest.Mock; find: jest.Mock };

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    taskRepo = { update: jest.fn(), find: jest.fn() };
    service = new GenerationTaskService(dataSource as never, taskRepo as never);
  });

  it('抢到任务（INSERT 成功）返回 true', async () => {
    dataSource.query.mockResolvedValue([{ id: 'task-1' }]);

    await expect(service.claim('n1', ArtifactKind.L3_CORE_TEXT)).resolves.toBe(true);
    expect(dataSource.query).toHaveBeenCalledTimes(1);
    const sql = dataSource.query.mock.calls[0][0] as string;
    expect(sql).toContain('on conflict (node_id, artifact_kind) do update');
    // 只有 PENDING / FAILED / 陈旧 GENERATING 才允许认领，READY 绝不能被抢走
    expect(sql).toContain("status in ('PENDING', 'FAILED')");
    expect(sql).toContain('interval');
  });

  it('抢不到（他人正在生成或已 READY）返回 false', async () => {
    dataSource.query.mockResolvedValue([]);
    await expect(service.claim('n1', ArtifactKind.L3_EXERCISES)).resolves.toBe(false);
  });

  it('陈旧阈值是 120 秒（传给 SQL）', async () => {
    dataSource.query.mockResolvedValue([]);
    await service.claim('n1', ArtifactKind.L3_CORE_TEXT);

    const params = dataSource.query.mock.calls[0][1] as unknown[];
    expect(params).toContain(STALE_GENERATING_MS);
    expect(STALE_GENERATING_MS).toBe(120_000);
  });

  it('markReady 写入状态、版本、模型与结束时间', async () => {
    await service.markReady('n1', ArtifactKind.L3_CORE_TEXT, {
      promptVersion: '1.0.0',
      model: 'deepseek-flash',
    });

    expect(taskRepo.update).toHaveBeenCalledWith(
      { nodeId: 'n1', artifactKind: ArtifactKind.L3_CORE_TEXT },
      expect.objectContaining({
        status: GenerationTaskStatus.READY,
        promptVersion: '1.0.0',
        model: 'deepseek-flash',
        lastError: null,
      }),
    );
  });

  it('markFailed 写入 FAILED 与错误摘要（截断到 1000 字）', async () => {
    await service.markFailed('n1', ArtifactKind.L3_EXERCISES, 'x'.repeat(1500));

    const payload = taskRepo.update.mock.calls[0][1] as { status: string; lastError: string };
    expect(payload.status).toBe(GenerationTaskStatus.FAILED);
    expect(payload.lastError.length).toBe(1000);
  });

  it('findForNode 按 kind 返回', async () => {
    taskRepo.find.mockResolvedValue([{ nodeId: 'n1' } as GenerationTask]);
    await expect(service.findForNode('n1')).resolves.toHaveLength(1);
    expect(taskRepo.find).toHaveBeenCalledWith({ where: { nodeId: 'n1' } });
  });
});
