import { ContentService } from './content.service';
import { NodeContent } from './entities/node-content.entity';
import { CodeExample } from './entities/code-example.entity';
import { Exercise } from './entities/exercise.entity';
import { NodeLevel } from '@skill/shared';

/**
 * 本 spec 覆盖「归属校验 + 短路行为」；
 * 写入路径（单事务）与「AI 失败不开事务」的不变量在 content.service.transaction.spec.ts。
 */
describe('ContentService（归属与短路）', () => {
  let service: ContentService;
  let contentRepo: { findOne: jest.Mock; update: jest.Mock };
  let nodeRepo: { findOne: jest.Mock };
  let treeRepo: { findOne: jest.Mock };
  let aiService: { generateL3: jest.Mock };
  let treeAccess: { assertNodeOwner: jest.Mock; assertTreeOwner: jest.Mock };
  let manager: { getRepository: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const l2Node = {
    id: 'node-1',
    treeId: 'tree-1',
    parentId: 'l1-1',
    level: NodeLevel.L2,
    title: 'L2 主题',
    description: 'd',
  };

  beforeEach(() => {
    contentRepo = { findOne: jest.fn(async () => null), update: jest.fn() };
    // assertNodeOwner 已返回节点，故 nodeRepo 只需再查一次 L1 父节点
    nodeRepo = { findOne: jest.fn(async () => ({ id: 'l1-1', title: 'L1 领域' })) };
    treeRepo = { findOne: jest.fn(async () => ({ id: 'tree-1', name: '前端工程化' })) };
    aiService = {
      generateL3: jest.fn(async () => ({
        coreText: '正文'.padEnd(60, '。'),
        codeExamples: [{ title: '示例', language: 'ts', code: 'const a = 1;' }],
        exercises: [{ question: 'Q', options: ['a', 'b'], correctIndex: 0, explanation: 'E' }],
      })),
    };
    treeAccess = {
      assertNodeOwner: jest.fn(async () => l2Node),
      assertTreeOwner: jest.fn(),
    };

    manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === NodeContent) {
          return { create: jest.fn((v) => v), save: jest.fn(async (v) => ({ ...v, id: 'c1' })) };
        }
        if (entity === CodeExample || entity === Exercise) {
          return { create: jest.fn((v) => v), save: jest.fn(async (v) => v) };
        }
        throw new Error('unexpected entity');
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

  it('生成前先校验归属', async () => {
    await service.generateContent('node-1', 'u1');

    expect(treeAccess.assertNodeOwner).toHaveBeenCalledWith('node-1', 'u1');
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
    expect(contentRepo.update).toHaveBeenCalledWith({ nodeId: 'node-1' }, { coreText: '新正文' });
  });

  it('已有内容时直接返回：不调 AI、不开事务（避免重复生成与浪费 token）', async () => {
    contentRepo.findOne.mockResolvedValue({ id: 'c1', nodeId: 'node-1', coreText: '已有' });

    const result = await service.generateContent('node-1', 'u1');

    expect(result).toMatchObject({ id: 'c1', coreText: '已有' });
    expect(aiService.generateL3).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
