import { ArtifactService } from './artifact.service';
import { NodeContent } from './entities/node-content.entity';
import { CodeExample } from './entities/code-example.entity';
import { Exercise } from './entities/exercise.entity';
import { ArtifactKind, GenerationTaskStatus, NodeLevel } from '@skill/shared';

/**
 * 说明（相对计划的一处偏差）：
 * 计划里的 spec 把「注入的 contentRepo」与「事务里的 manager.getRepository(NodeContent)」
 * mock 成两个不同的对象（前者返回已有内容、后者永远返回 null），
 * 这与实现不可能同时成立 —— 同一张表在测试里出现了两个互相矛盾的视图。
 * 这里改为**一个内存假库**：事务内外的 repo 指向同一对象，写入立即对读取可见。
 * 断言与用例名保持与计划一致。
 */
describe('ArtifactService', () => {
  let service: ArtifactService;
  let manager: { getRepository: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let tasks: {
    claim: jest.Mock;
    markReady: jest.Mock;
    markFailed: jest.Mock;
    findForNode: jest.Mock;
  };
  let ai: {
    generateL3CoreText: jest.Mock;
    generateL3CodeExamples: jest.Mock;
    generateL3Exercises: jest.Mock;
  };
  let treeAccess: { assertNodeOwner: jest.Mock };
  let nodeRepo: { findOne: jest.Mock };
  let treeRepo: { findOne: jest.Mock };
  let contentRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let txContent: typeof contentRepo;
  let txCode: { create: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let txExercise: { create: jest.Mock; save: jest.Mock; delete: jest.Mock };

  /** 内存假库 */
  let db: {
    content: Record<string, unknown> | null;
    codeExamples: Record<string, unknown>[];
    exercises: Record<string, unknown>[];
  };

  const node = {
    id: 'n1',
    treeId: 't1',
    parentId: 'l1',
    level: NodeLevel.L2,
    title: 'L2 主题',
    description: 'd',
  };

  beforeEach(() => {
    db = { content: null, codeExamples: [], exercises: [] };

    contentRepo = {
      findOne: jest.fn(async () => {
        if (!db.content) return null;
        return {
          ...db.content,
          codeExamples: [...db.codeExamples],
          exercises: [...db.exercises],
        };
      }),
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => {
        db.content = { id: 'c1', ...v };
        return db.content;
      }),
      update: jest.fn(async (_criteria, patch) => {
        db.content = { ...(db.content ?? {}), ...patch };
      }),
    };
    txCode = {
      create: jest.fn((v) => v),
      save: jest.fn(async (rows) => {
        db.codeExamples = Array.isArray(rows) ? rows : [rows];
        return rows;
      }),
      delete: jest.fn(async () => {
        db.codeExamples = [];
      }),
    };
    txExercise = {
      create: jest.fn((v) => v),
      save: jest.fn(async (rows) => {
        db.exercises = Array.isArray(rows) ? rows : [rows];
        return rows;
      }),
      delete: jest.fn(async () => {
        db.exercises = [];
      }),
    };
    txContent = contentRepo;

    manager = {
      getRepository: jest.fn((e: unknown) => {
        if (e === NodeContent) return contentRepo;
        if (e === CodeExample) return txCode;
        if (e === Exercise) return txExercise;
        throw new Error('unexpected entity');
      }),
    };
    dataSource = {
      transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) => cb(manager)),
    };

    tasks = {
      claim: jest.fn(async () => true),
      markReady: jest.fn(async () => undefined),
      markFailed: jest.fn(async () => undefined),
      findForNode: jest.fn(async () => []),
    };
    ai = {
      generateL3CoreText: jest.fn(async () => ({ coreText: '核心内容'.padEnd(60, '。') })),
      generateL3CodeExamples: jest.fn(async () => ({
        codeExamples: [{ title: 't', language: 'ts', code: 'c' }],
      })),
      generateL3Exercises: jest.fn(async () => ({
        exercises: [{ question: 'Q', options: ['a', 'b'], correctIndex: 0, explanation: 'E' }],
      })),
    };
    treeAccess = { assertNodeOwner: jest.fn(async () => node) };
    nodeRepo = { findOne: jest.fn(async () => ({ id: 'l1', title: 'L1' })) };
    treeRepo = { findOne: jest.fn(async () => ({ id: 't1', name: 'T' })) };

    service = new ArtifactService(
      dataSource as never,
      tasks as never,
      ai as never,
      treeAccess as never,
      nodeRepo as never,
      treeRepo as never,
      contentRepo as never,
    );
  });

  it('coreText：认领成功 → 调 AI → 单事务写 node_contents → markReady', async () => {
    await service.generateArtifact('n1', 'u1', ArtifactKind.L3_CORE_TEXT);

    expect(tasks.claim).toHaveBeenCalledWith('n1', ArtifactKind.L3_CORE_TEXT);
    expect(ai.generateL3CoreText).toHaveBeenCalledWith(
      expect.objectContaining({ l2Title: 'L2 主题', skillTreeName: 'T' }),
      expect.objectContaining({ userId: 'u1', treeId: 't1', nodeId: 'n1' }),
    );
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(txContent.save).toHaveBeenCalled();
    expect(tasks.markReady).toHaveBeenCalledWith(
      'n1',
      ArtifactKind.L3_CORE_TEXT,
      expect.objectContaining({ promptVersion: expect.any(String) }),
    );
  });

  it('认领失败（已 READY 或他人生成中）→ 完全不调 AI（幂等）', async () => {
    tasks.claim.mockResolvedValue(false);

    await service.generateArtifact('n1', 'u1', ArtifactKind.L3_CORE_TEXT);

    expect(ai.generateL3CoreText).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('生成 codeExamples 时若 coreText 未就绪 → 先生成 coreText（前置依赖）', async () => {
    // coreText 任务不存在且内容为空 → 需要前置生成
    expect(db.content).toBeNull();

    await service.generateArtifact('n1', 'u1', ArtifactKind.L3_CODE_EXAMPLES);

    expect(ai.generateL3CoreText).toHaveBeenCalledTimes(1);
    expect(ai.generateL3CodeExamples).toHaveBeenCalledWith(
      expect.objectContaining({ coreText: expect.stringContaining('核心内容') }),
      expect.anything(),
    );
  });

  it('已有 coreText 时不再前置生成，且把它传给 codeExamples 作为上下文', async () => {
    db.content = { id: 'c1', nodeId: 'n1', coreText: '已有核心内容', version: 1 };

    await service.generateArtifact('n1', 'u1', ArtifactKind.L3_CODE_EXAMPLES);

    expect(ai.generateL3CoreText).not.toHaveBeenCalled();
    expect(ai.generateL3CodeExamples).toHaveBeenCalledWith(
      expect.objectContaining({ coreText: '已有核心内容' }),
      expect.anything(),
    );
  });

  it('AI 失败 → markFailed 并抛出（不静默降级）', async () => {
    // 预置 coreText，跳过前置生成，让失败点精确落在 exercises 上
    db.content = { id: 'c1', nodeId: 'n1', coreText: '已有核心内容', version: 1 };
    ai.generateL3Exercises.mockRejectedValue(new Error('AI down'));

    await expect(service.generateArtifact('n1', 'u1', ArtifactKind.L3_EXERCISES)).rejects.toThrow(
      'AI down',
    );

    expect(tasks.markFailed).toHaveBeenCalledWith(
      'n1',
      ArtifactKind.L3_EXERCISES,
      expect.stringContaining('AI down'),
    );
    // 失败发生在写库之前，因此没有产生任何写入
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('coreText 正由他人生成时不失败：等待其落库后继续生成练习题', async () => {
    // 复现真实场景：用户点开 L2 后立刻切到「练习题」tab，
    // 此时 coreText 的生成请求仍在飞行中（GENERATING），本请求拿不到 coreText 认领。
    // 「等一会儿」不是失败 —— 既不能丢掉用户意图，也不能写 FAILED 污染状态机。
    let coreClaimCalls = 0;
    tasks.claim.mockImplementation(async (_nodeId: string, kind: ArtifactKind) => {
      if (kind !== ArtifactKind.L3_CORE_TEXT) return true;
      coreClaimCalls += 1;
      if (coreClaimCalls === 1) {
        // 模拟并发请求稍后把 coreText 落库
        setTimeout(() => {
          db.content = { id: 'c1', nodeId: 'n1', coreText: '他人生成的核心内容', version: 1 };
        }, 5);
        return false;
      }
      return true;
    });

    const view = await service.generateArtifact('n1', 'u1', ArtifactKind.L3_EXERCISES);

    expect(tasks.markFailed).not.toHaveBeenCalled();
    expect(ai.generateL3Exercises).toHaveBeenCalledWith(
      expect.objectContaining({ coreText: '他人生成的核心内容' }),
      expect.anything(),
    );
    expect(view.exercises.status).toBe(GenerationTaskStatus.READY);
  });

  it('getArtifacts：无 task 行但内容存在 → 状态按 READY 呈现（兼容历史数据）', async () => {
    tasks.findForNode.mockResolvedValue([]);
    db.content = { id: 'c1', nodeId: 'n1', coreText: '已有', version: 1 };

    const view = await service.getArtifacts('n1', 'u1');

    expect(view.coreText.status).toBe(GenerationTaskStatus.READY);
    expect(view.coreText.text).toBe('已有');
  });

  it('getArtifacts：无 task 行且无内容 → PENDING', async () => {
    tasks.findForNode.mockResolvedValue([]);

    const view = await service.getArtifacts('n1', 'u1');

    expect(view.coreText.status).toBe(GenerationTaskStatus.PENDING);
    expect(view.exercises.items).toEqual([]);
  });
});
