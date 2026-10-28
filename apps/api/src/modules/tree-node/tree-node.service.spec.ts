import { TreeNodeService } from './tree-node.service';
import { NodeLevel } from '@skill/shared';

describe('TreeNodeService（归属校验）', () => {
  let service: TreeNodeService;
  let nodeRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let treeRepo: { findOne: jest.Mock };
  let aiService: { generateL2: jest.Mock };
  let treeAccess: { assertNodeOwner: jest.Mock; assertTreeOwner: jest.Mock };

  beforeEach(() => {
    nodeRepo = {
      findOne: jest.fn(),
      find: jest.fn(async () => []),
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => v),
      update: jest.fn(),
      delete: jest.fn(),
    };
    treeRepo = { findOne: jest.fn(async () => ({ id: 't1', name: 'T' })) };
    aiService = { generateL2: jest.fn(async () => ({ nodes: [] })) };
    treeAccess = { assertNodeOwner: jest.fn(), assertTreeOwner: jest.fn() };
    service = new TreeNodeService(
      nodeRepo as never,
      treeRepo as never,
      aiService as never,
      treeAccess as never,
    );
  });

  it('expand 前先校验归属', async () => {
    treeAccess.assertNodeOwner.mockResolvedValue({
      id: 'n1',
      treeId: 't1',
      level: NodeLevel.L1,
      title: 'L1',
      description: 'd',
    });

    await service.expand('n1', 'u1');

    expect(treeAccess.assertNodeOwner).toHaveBeenCalledWith('n1', 'u1');
  });

  it('remove 前先校验归属', async () => {
    treeAccess.assertNodeOwner.mockResolvedValue({ id: 'n1', treeId: 't1' });

    await service.remove('n1', 'u1');

    expect(treeAccess.assertNodeOwner).toHaveBeenCalledWith('n1', 'u1');
    expect(nodeRepo.delete).toHaveBeenCalledWith('n1');
  });

  it('update 只把白名单字段交给 repo', async () => {
    treeAccess.assertNodeOwner.mockResolvedValue({ id: 'n1', treeId: 't1' });
    nodeRepo.findOne.mockResolvedValue({ id: 'n1', title: 'new' });

    await service.update('n1', { title: 'new' }, 'u1');

    expect(nodeRepo.update).toHaveBeenCalledWith('n1', { title: 'new' });
  });

  it('findChildren 前先校验归属', async () => {
    treeAccess.assertNodeOwner.mockResolvedValue({ id: 'n1', treeId: 't1' });

    await service.findChildren('n1', 'u1');

    expect(treeAccess.assertNodeOwner).toHaveBeenCalledWith('n1', 'u1');
    expect(nodeRepo.find).toHaveBeenCalledWith({
      where: { parentId: 'n1' },
      order: { sortOrder: 'ASC' },
    });
  });

  it('并发展开同一节点只调一次 AI（双击/重试不产生重复 L2）', async () => {
    treeAccess.assertNodeOwner.mockResolvedValue({
      id: 'n1',
      treeId: 't1',
      level: NodeLevel.L1,
      title: 'L1',
      description: 'd',
    });
    nodeRepo.find.mockResolvedValue([]); // 尚无子节点
    let resolveAi: (v: unknown) => void;
    aiService.generateL2.mockReturnValue(
      new Promise((r) => {
        resolveAi = r;
      }),
    );

    const p1 = service.expand('n1', 'u1');
    const p2 = service.expand('n1', 'u1');

    // 等 doExpand 推进到 AI 调用处（归属校验与子节点查询各是一次 await）
    await new Promise((r) => setImmediate(r));
    expect(aiService.generateL2).toHaveBeenCalledTimes(1);

    resolveAi!({ nodes: [{ title: 'A', description: '' }] });
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toHaveLength(1);
    expect(r2).toHaveLength(1);
  });

  it('展开完成后再次展开直接返回已有子节点，不重复调 AI', async () => {
    treeAccess.assertNodeOwner.mockResolvedValue({
      id: 'n1',
      treeId: 't1',
      level: NodeLevel.L1,
      title: 'L1',
      description: 'd',
    });
    nodeRepo.find.mockResolvedValue([]);
    aiService.generateL2.mockResolvedValue({ nodes: [{ title: 'A', description: '' }] });

    await service.expand('n1', 'u1');
    nodeRepo.find.mockResolvedValue([{ id: 'c1', title: 'A' }]);

    const again = await service.expand('n1', 'u1');

    expect(aiService.generateL2).toHaveBeenCalledTimes(1);
    expect(again).toHaveLength(1);
  });
});
