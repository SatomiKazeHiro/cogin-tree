import { ContentService } from './content.service';
import { NodeContent } from './entities/node-content.entity';
import { CodeExample } from './entities/code-example.entity';
import { Exercise } from './entities/exercise.entity';
import { NodeLevel } from '@skill/shared';

describe('ContentService（先算后落库）', () => {
  let service: ContentService;
  let contentRepo: { findOne: jest.Mock };
  let nodeRepo: { findOne: jest.Mock };
  let treeRepo: { findOne: jest.Mock };
  let aiService: { generateL3: jest.Mock };
  let treeAccess: { assertNodeOwner: jest.Mock };
  let txContent: { create: jest.Mock; save: jest.Mock };
  let txCode: { create: jest.Mock; save: jest.Mock };
  let txExercise: { create: jest.Mock; save: jest.Mock };
  let manager: { getRepository: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const node = {
    id: 'n1',
    treeId: 't1',
    parentId: 'l1',
    level: NodeLevel.L2,
    title: 'L2',
    description: 'd',
  };

  beforeEach(() => {
    contentRepo = { findOne: jest.fn(async () => null) };
    nodeRepo = { findOne: jest.fn(async () => ({ id: 'l1', title: 'L1' })) };
    treeRepo = { findOne: jest.fn(async () => ({ id: 't1', name: 'Tree' })) };
    aiService = { generateL3: jest.fn() };
    treeAccess = { assertNodeOwner: jest.fn(async () => node) };

    txContent = { create: jest.fn((v) => v), save: jest.fn(async (v) => ({ ...v, id: 'c1' })) };
    txCode = { create: jest.fn((v) => v), save: jest.fn(async (v) => v) };
    txExercise = { create: jest.fn((v) => v), save: jest.fn(async (v) => v) };

    manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === NodeContent) return txContent;
        if (entity === CodeExample) return txCode;
        if (entity === Exercise) return txExercise;
        throw new Error('unexpected entity in manager.getRepository');
      }),
    };
    dataSource = {
      transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) => cb(manager)),
    };

    service = new ContentService(
      contentRepo as never,
      nodeRepo as never,
      treeRepo as never,
      aiService as never,
      treeAccess as never,
      dataSource as never,
    );
  });

  it('AI 失败时绝不开启事务（关键不变量：不留半成品数据）', async () => {
    aiService.generateL3.mockRejectedValue(new Error('AI down'));

    await expect(service.generateContent('n1', 'u1')).rejects.toThrow('AI down');

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(txContent.save).not.toHaveBeenCalled();
  });

  it('AI 成功后在一个事务里写入内容/代码示例/练习', async () => {
    aiService.generateL3.mockResolvedValue({
      coreText: '正文'.padEnd(60, '。'),
      codeExamples: [{ title: 't', language: 'ts', code: 'c' }],
      exercises: [{ question: 'Q', options: ['a', 'b'], correctIndex: 0, explanation: 'E' }],
    });

    await service.generateContent('n1', 'u1');

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(txContent.save).toHaveBeenCalled();
    expect(txCode.save).toHaveBeenCalled();
    expect(txExercise.save).toHaveBeenCalled();
  });

  it('AI 调用带上审计上下文（userId/treeId/nodeId）', async () => {
    aiService.generateL3.mockResolvedValue({
      coreText: '正文'.padEnd(60, '。'),
      codeExamples: [],
      exercises: [{ question: 'Q', options: ['a', 'b'], correctIndex: 0, explanation: 'E' }],
    });

    await service.generateContent('n1', 'u1');

    expect(aiService.generateL3).toHaveBeenCalledWith(
      'L1',
      'L2',
      'Tree',
      expect.objectContaining({ userId: 'u1', treeId: 't1', nodeId: 'n1' }),
    );
  });
});
