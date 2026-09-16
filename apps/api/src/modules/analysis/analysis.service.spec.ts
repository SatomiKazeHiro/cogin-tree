import { BadRequestException } from '@nestjs/common';
import {
  AnalysisJobStatus,
  AnalysisType,
  ExpireLevel,
  NodeLevel,
  NodeStatus,
  SuggestionAction,
  SuggestionStatus,
  TreeType,
} from '@skill/shared';
import { AnalysisService } from './analysis.service';
import { SuggestedChange } from './entities/suggested-change.entity';
import { TreeNode } from '../skill-tree/entities/tree-node.entity';

describe('AnalysisService', () => {
  let service: AnalysisService;
  let jobRepo: { save: jest.Mock; update: jest.Mock; create: jest.Mock };
  let suggestionRepo: { save: jest.Mock; findOne: jest.Mock; find: jest.Mock; create: jest.Mock };
  let nodeRepo: { save: jest.Mock; findOne: jest.Mock; find: jest.Mock; create: jest.Mock };
  let skillTreeService: { findById: jest.Mock };
  let aiService: { generateDiscoverNew: jest.Mock; generateCheckExpire: jest.Mock };

  const suggestion = (overrides: Partial<SuggestedChange>): SuggestedChange =>
    ({
      id: 's-1',
      jobId: 'j-1',
      action: SuggestionAction.ADD,
      title: '新主题',
      status: SuggestionStatus.PENDING,
      job: { treeId: 't-1' },
      ...overrides,
    }) as SuggestedChange;

  beforeEach(() => {
    jobRepo = {
      save: jest.fn(async (j) => ({ id: 'j-1', ...j })),
      update: jest.fn(),
      create: jest.fn((j) => j),
    };
    suggestionRepo = {
      save: jest.fn(async (s) => (Array.isArray(s) ? s : { ...s })),
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((s) => s),
    };
    nodeRepo = {
      save: jest.fn(async (n) => n),
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((n) => n),
    };
    skillTreeService = { findById: jest.fn() };
    aiService = { generateDiscoverNew: jest.fn(), generateCheckExpire: jest.fn() };

    service = new AnalysisService(
      jobRepo as never,
      suggestionRepo as never,
      nodeRepo as never,
      skillTreeService as never,
      aiService as never,
    );
  });

  describe('applySuggestion - ADD', () => {
    it('有父节点：创建 L2，sortOrder 取同级数量', async () => {
      suggestionRepo.findOne.mockResolvedValue(
        suggestion({ parentNodeId: 'p-1', description: '描述' }),
      );
      nodeRepo.findOne.mockResolvedValue({ id: 'p-1', level: NodeLevel.L1 });
      nodeRepo.find.mockResolvedValue([{ id: 'x' }, { id: 'y' }]);

      await service.applySuggestion('s-1');

      expect(nodeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          treeId: 't-1',
          parentId: 'p-1',
          level: NodeLevel.L2,
          sortOrder: 2,
          status: NodeStatus.ACTIVE,
        }),
      );
      expect(suggestionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SuggestionStatus.APPLIED }),
      );
    });

    it('无父节点：创建 L1，sortOrder 取同级数量', async () => {
      suggestionRepo.findOne.mockResolvedValue(suggestion({ parentNodeId: undefined }));
      nodeRepo.find.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

      await service.applySuggestion('s-1');

      expect(nodeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          treeId: 't-1',
          level: NodeLevel.L1,
          sortOrder: 3,
        }),
      );
      expect(nodeRepo.save.mock.calls[0][0]).not.toHaveProperty('parentId');
    });
  });

  describe('applySuggestion - EXPIRE', () => {
    it.each([
      [ExpireLevel.I, NodeStatus.OUTDATED_I],
      [ExpireLevel.II, NodeStatus.OUTDATED_II],
      [ExpireLevel.III, NodeStatus.OUTDATED_III],
    ])('过期等级 %s → 节点状态 %s', async (level, expected) => {
      suggestionRepo.findOne.mockResolvedValue(
        suggestion({
          action: SuggestionAction.EXPIRE,
          targetNodeId: 'n-1',
          expireLevel: level,
        }),
      );
      const node: Partial<TreeNode> = { id: 'n-1', status: NodeStatus.ACTIVE };
      nodeRepo.findOne.mockResolvedValue(node);

      await service.applySuggestion('s-1');

      expect(node.status).toBe(expected);
      expect(nodeRepo.save).toHaveBeenCalledWith(node);
    });
  });

  describe('状态约束', () => {
    it('已处理的建议不能重复采纳', async () => {
      suggestionRepo.findOne.mockResolvedValue(
        suggestion({ status: SuggestionStatus.APPLIED }),
      );
      await expect(service.applySuggestion('s-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('忽略：PENDING → IGNORED，且不能重复忽略', async () => {
      suggestionRepo.findOne.mockResolvedValue(suggestion({}));
      const result = await service.ignoreSuggestion('s-1');
      expect(result.status).toBe(SuggestionStatus.IGNORED);

      suggestionRepo.findOne.mockResolvedValue(
        suggestion({ status: SuggestionStatus.IGNORED }),
      );
      await expect(service.ignoreSuggestion('s-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('analyze（标题匹配与降级）', () => {
    it('ADD 匹配父标题 / EXPIRE 匹配节点标题，匹配不到的 EXPIRE 丢弃', async () => {
      suggestionRepo.find.mockResolvedValue([]);
      const l1 = { id: 'l1', title: '前端基础', level: NodeLevel.L1, sortOrder: 0 };
      const l2 = {
        id: 'l2a',
        title: 'jQuery 基础',
        level: NodeLevel.L2,
        parentId: 'l1',
        sortOrder: 0,
      };
      skillTreeService.findById.mockResolvedValue({
        id: 't-1',
        name: '前端',
        type: TreeType.ENTRY,
        nodes: [l1, l2],
      });
      aiService.generateDiscoverNew.mockResolvedValue({
        suggestions: [
          { parentTitle: '前端基础', title: 'TypeScript 进阶', description: 'd', reason: 'r' },
          { parentTitle: null, title: 'AI 工程', description: 'd', reason: 'r' },
        ],
      });
      aiService.generateCheckExpire.mockResolvedValue({
        suggestions: [
          { nodeTitle: 'jQuery 基础', expireLevel: 3, reason: '被淘汰' },
          { nodeTitle: '不存在的节点', expireLevel: 1, reason: 'x' },
        ],
      });

      const saved = await service.analyze('t-1');

      expect(saved).toHaveLength(3);
      const [addWithParent, addAsL1, expire] = saved;
      expect(addWithParent).toMatchObject({
        action: SuggestionAction.ADD,
        parentNodeId: 'l1',
      });
      expect(addAsL1.parentNodeId).toBeUndefined();
      expect(expire).toMatchObject({
        action: SuggestionAction.EXPIRE,
        targetNodeId: 'l2a',
        expireLevel: ExpireLevel.III,
      });
      // 两类分析各落一个 job
      expect(jobRepo.save).toHaveBeenCalledTimes(2);
      expect(jobRepo.update).toHaveBeenCalledWith(
        'j-1',
        expect.objectContaining({ status: AnalysisJobStatus.COMPLETED }),
      );
    });

    it('AI 全部失败时：job 标记 FAILED，返回空建议且不抛错', async () => {
      suggestionRepo.find.mockResolvedValue([]);
      skillTreeService.findById.mockResolvedValue({
        id: 't-1',
        name: '前端',
        type: TreeType.ENTRY,
        nodes: [],
      });
      aiService.generateDiscoverNew.mockRejectedValue(new Error('AI 失败'));
      aiService.generateCheckExpire.mockRejectedValue(new Error('AI 失败'));

      const saved = await service.analyze('t-1');

      expect(saved).toEqual([]);
      expect(jobRepo.update).toHaveBeenCalledWith(
        'j-1',
        expect.objectContaining({ status: AnalysisJobStatus.FAILED }),
      );
      expect(AnalysisType.DISCOVER_NEW).toBeDefined();
    });
  });
});
