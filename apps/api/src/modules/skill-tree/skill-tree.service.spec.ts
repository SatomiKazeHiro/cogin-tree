import { SkillTreeService } from './skill-tree.service';
import { TreeType } from '@skill/shared';

describe('SkillTreeService.create（写入归属）', () => {
  let service: SkillTreeService;
  let treeRepo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock };
  let nodeRepo: { create: jest.Mock; save: jest.Mock; find: jest.Mock };
  let recordRepo: { create: jest.Mock; save: jest.Mock };
  let aiService: { generateL1: jest.Mock; generateL1FromPoints: jest.Mock };

  beforeEach(() => {
    treeRepo = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ ...v, id: 'tree-1' })),
      findOne: jest.fn(async () => ({
        id: 'tree-1',
        name: '前端工程化',
        ownerId: 'user-1',
        nodes: [],
      })),
    };
    nodeRepo = { create: jest.fn((v) => v), save: jest.fn(async (v) => v), find: jest.fn() };
    recordRepo = { create: jest.fn((v) => v), save: jest.fn(async (v) => v) };
    aiService = {
      generateL1: jest.fn(async () => ({ nodes: [{ title: 'A', description: 'a' }] })),
      generateL1FromPoints: jest.fn(),
    };
    service = new SkillTreeService(
      treeRepo as never,
      nodeRepo as never,
      recordRepo as never,
      aiService as never,
    );
  });

  it('创建技能树时写入 ownerId = 当前用户', async () => {
    await service.create({ name: '前端工程化', type: TreeType.ENTRY }, 'user-1');

    expect(treeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: '前端工程化', ownerId: 'user-1' }),
    );
    expect(recordRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', skillTreeId: 'tree-1' }),
    );
  });
});
