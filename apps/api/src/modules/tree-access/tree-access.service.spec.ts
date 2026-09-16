import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TreeAccessService } from './tree-access.service';

describe('TreeAccessService', () => {
  let service: TreeAccessService;
  let treeRepo: { findOne: jest.Mock };
  let nodeRepo: { findOne: jest.Mock };

  beforeEach(() => {
    treeRepo = { findOne: jest.fn() };
    nodeRepo = { findOne: jest.fn() };
    service = new TreeAccessService(treeRepo as never, nodeRepo as never);
  });

  it('本人可访问自己的树', async () => {
    treeRepo.findOne.mockResolvedValue({ id: 't1', ownerId: 'u1' });
    await expect(service.assertTreeOwner('t1', 'u1')).resolves.toMatchObject({ id: 't1' });
  });

  it('他人访问 → 403', async () => {
    treeRepo.findOne.mockResolvedValue({ id: 't1', ownerId: 'u1' });
    await expect(service.assertTreeOwner('t1', 'u2')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('树不存在 → 404', async () => {
    treeRepo.findOne.mockResolvedValue(null);
    await expect(service.assertTreeOwner('t1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('节点归属按其所属树判定', async () => {
    nodeRepo.findOne.mockResolvedValue({ id: 'n1', treeId: 't1' });
    treeRepo.findOne.mockResolvedValue({ id: 't1', ownerId: 'u1' });
    await expect(service.assertNodeOwner('n1', 'u1')).resolves.toMatchObject({ id: 'n1' });
    await expect(service.assertNodeOwner('n1', 'u2')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('节点不存在 → 404', async () => {
    nodeRepo.findOne.mockResolvedValue(null);
    await expect(service.assertNodeOwner('n1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
