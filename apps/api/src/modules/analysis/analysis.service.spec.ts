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
  let treeAccess: { assertTreeOwner: jest.Mock; assertNodeOwner: jest.Mock };

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
    treeAccess = { assertTreeOwner: jest.fn(), assertNodeOwner: jest.fn() };

    service = new AnalysisService(
      jobRepo as never,
      suggestionRepo as never,
      nodeRepo as never,
      skillTreeService as never,
      aiService as never,
      treeAccess as never,
    );
  });

  describe('applySuggestion - ADD', () => {
    it('有父节点：创建 L2，sortOrder 取同级数量', async () => {
      suggestionRepo.findOne.mockResolvedValue(
        suggestion({ parentNodeId: 'p-1', description: '描述' }),
      );
      nodeRepo.findOne.mockResolvedValue({ id: 'p-1', level: NodeLevel.L1 });
      nodeRepo.find.mockResolvedValue([{ id: 'x' }, { id: 'y' }]);

      await service.applySuggestion('s-1', 'u1');

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

      await service.applySuggestion('s-1', 'u1');

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

      await service.applySuggestion('s-1', 'u1');

      expect(node.status).toBe(expected);
      expect(nodeRepo.save).toHaveBeenCalledWith(node);
    });
  });

  describe('状态约束', () => {
    it('已处理的建议不能重复采纳', async () => {
      suggestionRepo.findOne.mockResolvedValue(
        suggestion({ status: SuggestionStatus.APPLIED }),
      );
      await expect(service.applySuggestion('s-1', 'u1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('忽略：PENDING → IGNORED，且不能重复忽略', async () => {
      suggestionRepo.findOne.mockResolvedValue(suggestion({}));
      const result = await service.ignoreSuggestion('s-1', 'u1');
      expect(result.status).toBe(SuggestionStatus.IGNORED);

      suggestionRepo.findOne.mockResolvedValue(
        suggestion({ status: SuggestionStatus.IGNORED }),
      );
      await expect(service.ignoreSuggestion('s-1', 'u1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('归属校验', () => {
    it('分析前先校验树归属（经 SkillTreeService.findById 携带 userId）', async () => {
      suggestionRepo.find.mockResolvedValue([]);
      skillTreeService.findById.mockResolvedValue({
        id: 't-1',
        name: '前端',
        type: TreeType.ENTRY,
        nodes: [],
      });
      aiService.generateDiscoverNew.mockResolvedValue({ suggestions: [] });
      aiService.generateCheckExpire.mockResolvedValue({ suggestions: [] });

      await service.analyze('t-1', 'u1');

      expect(skillTreeService.findById).toHaveBeenCalledWith('t-1', 'u1');
    });

    it('待处理建议列表前先校验树归属', async () => {
      suggestionRepo.find.mockResolvedValue([]);

      await service.findPendingSuggestions('t-1', 'u1');

      expect(treeAccess.assertTreeOwner).toHaveBeenCalledWith('t-1', 'u1');
    });

    it('采纳建议时按建议所属树校验归属，且校验早于状态检查', async () => {
      suggestionRepo.findOne.mockResolvedValue(
        suggestion({ status: SuggestionStatus.APPLIED }),
      );

      // 校验抛错时应先于「已处理」的 BadRequestException 暴露
      treeAccess.assertTreeOwner.mockRejectedValue(new Error('forbidden'));
      await expect(service.applySuggestion('s-1', 'u2')).rejects.toThrow('forbidden');
      expect(treeAccess.assertTreeOwner).toHaveBeenCalledWith('t-1', 'u2');
    });

    it('忽略建议时按建议所属树校验归属', async () => {
      suggestionRepo.findOne.mockResolvedValue(suggestion({}));

      await service.ignoreSuggestion('s-1', 'u1');

      expect(treeAccess.assertTreeOwner).toHaveBeenCalledWith('t-1', 'u1');
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

      const saved = await service.analyze('t-1', 'u1');

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

    it('EXPIRE 只接受精确匹配（「Java」不命中「JavaScript」）；ADD 父标题仍允许模糊', async () => {
      suggestionRepo.find.mockResolvedValue([]);
      const l1 = { id: 'l1', title: 'JavaScript 基础', level: NodeLevel.L1, sortOrder: 0 };
      const l2 = {
        id: 'l2a',
        title: 'JavaScript 高级',
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
          // 模糊命中 l1：挂载位置允许兜底（采纳前有人工审）
          { parentTitle: 'JavaScript', title: '新主题', description: 'd', reason: 'r' },
        ],
      });
      aiService.generateCheckExpire.mockResolvedValue({
        suggestions: [
          // 只给子串：绝不能模糊命中后把节点状态改错
          { nodeTitle: 'JavaScript', expireLevel: 2, reason: 'x' },
        ],
      });

      const saved = await service.analyze('t-1', 'u1');

      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({
        action: SuggestionAction.ADD,
        parentNodeId: 'l1',
      });
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

      const saved = await service.analyze('t-1', 'u1');

      expect(saved).toEqual([]);
      expect(jobRepo.update).toHaveBeenCalledWith(
        'j-1',
        expect.objectContaining({ status: AnalysisJobStatus.FAILED }),
      );
      expect(AnalysisType.DISCOVER_NEW).toBeDefined();
    });
  });
});
