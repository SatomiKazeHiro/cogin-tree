import { SkillTreeService } from './skill-tree.service';
import { TreeType } from '@skill/shared';

describe('SkillTreeService', () => {
  let service: SkillTreeService;
  let treeRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let nodeRepo: { create: jest.Mock; save: jest.Mock; find: jest.Mock; delete: jest.Mock };
  let recordRepo: { create: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let aiService: { generateL1: jest.Mock; generateL1FromPoints: jest.Mock };
  let treeAccess: { assertTreeOwner: jest.Mock; assertNodeOwner: jest.Mock };

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
      update: jest.fn(),
      delete: jest.fn(),
    };
    nodeRepo = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => v),
      find: jest.fn(),
      delete: jest.fn(),
    };
    recordRepo = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => v),
      delete: jest.fn(),
    };
    aiService = {
      generateL1: jest.fn(async () => ({ nodes: [{ title: 'A', description: 'a' }] })),
      generateL1FromPoints: jest.fn(),
    };
    treeAccess = { assertTreeOwner: jest.fn(), assertNodeOwner: jest.fn() };
    service = new SkillTreeService(
      treeRepo as never,
      nodeRepo as never,
      recordRepo as never,
      aiService as never,
      treeAccess as never,
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

  it('findById 校验归属后返回', async () => {
    await service.findById('tree-1', 'user-1');

    expect(treeAccess.assertTreeOwner).toHaveBeenCalledWith('tree-1', 'user-1');
  });

  it('remove 只删树本身（子行交给数据库级联）', async () => {
    await service.remove('tree-1', 'user-1');

    expect(treeAccess.assertTreeOwner).toHaveBeenCalledWith('tree-1', 'user-1');
    expect(treeRepo.delete).toHaveBeenCalledWith('tree-1');
    expect(nodeRepo.delete).not.toHaveBeenCalled();
    expect(recordRepo.delete).not.toHaveBeenCalled();
  });
});
