import { NodeLevel, NodeStatus } from '@skill/shared';
import { InterviewService } from './interview.service';
import { TreeNode } from '../skill-tree/entities/tree-node.entity';

describe('InterviewService.findForTree（聚合 + 懒生成）', () => {
  let service: InterviewService;
  let questionRepo: { find: jest.Mock; save: jest.Mock; create: jest.Mock };
  let skillTreeService: { findById: jest.Mock };
  let aiService: { generateInterviewQA: jest.Mock };

  const l1 = {
    id: 'l1',
    title: '前端基础',
    level: NodeLevel.L1,
    sortOrder: 0,
    status: NodeStatus.ACTIVE,
  } as TreeNode;
  const l2a = {
    id: 'n-a',
    title: '主题A',
    level: NodeLevel.L2,
    parentId: 'l1',
    sortOrder: 0,
    status: NodeStatus.ACTIVE,
  } as TreeNode;
  const l2b = {
    id: 'n-b',
    title: '主题B',
    level: NodeLevel.L2,
    parentId: 'l1',
    sortOrder: 1,
    status: NodeStatus.OUTDATED_II,
  } as TreeNode;

  beforeEach(() => {
    questionRepo = {
      find: jest.fn(),
      save: jest.fn(async (q) => q),
      create: jest.fn((q) => q),
    };
    skillTreeService = {
      findById: jest.fn().mockResolvedValue({
        id: 't-1',
        name: '前端面试',
        nodes: [l1, l2a, l2b],
      }),
    };
    aiService = { generateInterviewQA: jest.fn() };
    service = new InterviewService(
      questionRepo as never,
      skillTreeService as never,
      aiService as never,
    );
  });

  it('读取前先校验树归属（经 SkillTreeService.findById 携带 userId）', async () => {
    questionRepo.find.mockResolvedValue([]);

    await service.findForTree('t-1', 'u1');

    expect(skillTreeService.findById).toHaveBeenCalledWith('t-1', 'u1');
  });

  it('有题节点返回题目并分组；无题节点触发后台生成但不阻塞响应', async () => {
    questionRepo.find.mockResolvedValue([
      { id: 'q-1', l2NodeId: 'n-a', question: 'Q1', sortOrder: 0 },
    ]);
    aiService.generateInterviewQA.mockResolvedValue({
      questions: [{ question: 'Q', answer: 'A', difficulty: 'EASY' }],
    });

    const groups = await service.findForTree('t-1', 'u1');

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      nodeId: 'n-a',
      nodeTitle: '主题A',
      l1Title: '前端基础',
      nodeStatus: NodeStatus.ACTIVE,
    });
    expect(groups[0].questions).toHaveLength(1);
    // 无题节点：立即返回空数组，并触发后台生成
    expect(groups[1].questions).toEqual([]);
    expect(groups[1].nodeStatus).toBe(NodeStatus.OUTDATED_II);

    // 后台生成完成后落库
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(aiService.generateInterviewQA).toHaveBeenCalledTimes(1);
    expect(aiService.generateInterviewQA).toHaveBeenCalledWith(
      expect.objectContaining({ l2Title: '主题B', l1Title: '前端基础' }),
      // 第二个参数是审计上下文（ai_generations 的 user/tree/node 关联）
      expect.objectContaining({ userId: 'u1', treeId: 't-1', nodeId: 'n-b' }),
    );
    expect(questionRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ l2NodeId: 'n-b', treeId: 't-1' }),
    ]);
  });

  it('同一节点并发生成去重：连续两次请求只调一次 AI', async () => {
    questionRepo.find.mockResolvedValue([]);
    let resolveAi: (v: unknown) => void;
    aiService.generateInterviewQA.mockReturnValue(
      new Promise((r) => {
        resolveAi = r;
      }),
    );

    await service.findForTree('t-1', 'u1');
    await service.findForTree('t-1', 'u1');

    // 两个无题节点各一次，共 2 次；第二次请求未重复触发
    expect(aiService.generateInterviewQA).toHaveBeenCalledTimes(2);

    resolveAi!({ questions: [] });
    await new Promise((r) => setImmediate(r));
  });

  it('后台生成失败不影响响应，后续请求可重试', async () => {
    questionRepo.find.mockResolvedValue([]);
    aiService.generateInterviewQA.mockRejectedValue(new Error('AI 失败'));

    const groups = await service.findForTree('t-1', 'u1');

    expect(groups).toHaveLength(2);
    // 等待后台 catch 执行完，确认无未处理异常
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    // 失败后 generating 已清理，再次请求会重新触发
    await service.findForTree('t-1', 'u1');
    expect(aiService.generateInterviewQA).toHaveBeenCalledTimes(4);
  });
});
