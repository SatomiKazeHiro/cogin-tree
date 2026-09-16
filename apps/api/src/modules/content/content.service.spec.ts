import { ContentService } from './content.service';
import { NodeLevel } from '@skill/shared';

describe('ContentService', () => {
  let service: ContentService;
  let contentRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock };
  let exerciseRepo: { create: jest.Mock; save: jest.Mock };
  let codeExampleRepo: { create: jest.Mock; save: jest.Mock };
  let nodeRepo: { findOne: jest.Mock };
  let treeRepo: { findOne: jest.Mock };
  let aiService: { generateL3: jest.Mock };
  let treeAccess: { assertNodeOwner: jest.Mock; assertTreeOwner: jest.Mock };

  const l2Node = {
    id: 'node-1',
    treeId: 'tree-1',
    parentId: 'l1-1',
    level: NodeLevel.L2,
    title: 'L2 主题',
    description: 'd',
  };

  beforeEach(() => {
    contentRepo = {
      findOne: jest.fn(async () => null),
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ ...v, id: 'content-1' })),
      update: jest.fn(),
    };
    exerciseRepo = { create: jest.fn((v) => v), save: jest.fn(async (v) => v) };
    codeExampleRepo = { create: jest.fn((v) => v), save: jest.fn(async (v) => v) };
    // assertNodeOwner 已返回节点，故 nodeRepo 只需再查一次 L1 父节点
    nodeRepo = { findOne: jest.fn(async () => ({ id: 'l1-1', title: 'L1 领域' })) };
    treeRepo = { findOne: jest.fn(async () => ({ id: 'tree-1', name: '前端工程化' })) };
    aiService = {
      generateL3: jest.fn(async () => ({
        coreText: '正文',
        codeExamples: [{ title: '示例', language: 'ts', code: 'const a = 1;' }],
        exercises: [
          { question: 'Q', options: ['a', 'b'], correctIndex: 0, explanation: 'E' },
        ],
      })),
    };
    treeAccess = {
      assertNodeOwner: jest.fn(async () => l2Node),
      assertTreeOwner: jest.fn(),
    };
    service = new ContentService(
      contentRepo as never,
      exerciseRepo as never,
      codeExampleRepo as never,
      nodeRepo as never,
      treeRepo as never,
      aiService as never,
      treeAccess as never,
    );
  });

  it('生成前先校验归属', async () => {
    await service.generateContent('node-1', 'u1');

    expect(treeAccess.assertNodeOwner).toHaveBeenCalledWith('node-1', 'u1');
  });

  it('把 codeExamples 与 exercises 分别写入子表', async () => {
    await service.generateContent('node-1', 'u1');

    expect(codeExampleRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeContentId: 'content-1',
        title: '示例',
        language: 'ts',
        code: 'const a = 1;',
        sortOrder: 0,
      }),
    );
    expect(exerciseRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ nodeContentId: 'content-1', question: 'Q', sortOrder: 0 }),
    );
    // 内容行不再包含 codeExamples 字段
    expect(contentRepo.create).toHaveBeenCalledWith({
      nodeId: 'node-1',
      coreText: '正文',
      version: 1,
    });
  });

  it('读取前先校验归属', async () => {
    contentRepo.findOne.mockResolvedValue({
      id: 'c1',
      nodeId: 'node-1',
      exercises: [],
      codeExamples: [],
    });

    await service.getContentByNodeId('node-1', 'u1');

    expect(treeAccess.assertNodeOwner).toHaveBeenCalledWith('node-1', 'u1');
  });

  it('更新前先校验归属，且只接受白名单字段', async () => {
    contentRepo.findOne.mockResolvedValue({ id: 'c1', nodeId: 'node-1', coreText: '新正文' });

    await service.updateContent('node-1', { coreText: '新正文' }, 'u1');

    expect(treeAccess.assertNodeOwner).toHaveBeenCalledWith('node-1', 'u1');
    expect(contentRepo.update).toHaveBeenCalledWith(
      { nodeId: 'node-1' },
      { coreText: '新正文' },
    );
  });
});
