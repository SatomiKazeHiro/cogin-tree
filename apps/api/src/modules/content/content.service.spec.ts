import { NotFoundException } from '@nestjs/common';
import { ContentService } from './content.service';
import { ArtifactKind, NodeLevel } from '@skill/shared';

/**
 * 本 spec 覆盖「归属校验 + 委托/短路行为」。
 *
 * 生成编排（认领幂等、coreText 前置、单事务落库、失败标记）已移入 `ArtifactService`，
 * 由 `artifact.service.spec.ts` 覆盖；状态机由 `generation-task.service.spec.ts` 覆盖。
 */
describe('ContentService（归属与短路）', () => {
  let service: ContentService;
  let contentRepo: { findOne: jest.Mock; update: jest.Mock };
  let artifactService: { generateArtifact: jest.Mock };
  let treeAccess: { assertNodeOwner: jest.Mock };

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
    artifactService = { generateArtifact: jest.fn(async () => undefined) };
    treeAccess = { assertNodeOwner: jest.fn(async () => l2Node) };

    service = new ContentService(contentRepo as never, artifactService as never, treeAccess as never);
  });

  it('生成时的归属校验由 ArtifactService 完成，异常原样上抛', async () => {
    artifactService.generateArtifact.mockRejectedValue(new NotFoundException('not found'));

    await expect(service.generateContent('node-1', 'u1')).rejects.toThrow(NotFoundException);
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

  it('已有内容时直接返回：不委托生成（避免覆盖历史内容与浪费 token）', async () => {
    contentRepo.findOne.mockResolvedValue({ id: 'c1', nodeId: 'node-1', coreText: '已有' });

    const result = await service.generateContent('node-1', 'u1');

    expect(result).toMatchObject({ id: 'c1', coreText: '已有' });
    expect(artifactService.generateArtifact).not.toHaveBeenCalled();
  });

  it('无内容时委托 ArtifactService 生成 coreText，并返回生成后的内容', async () => {
    contentRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'c1', nodeId: 'node-1', coreText: '新生成' });

    const result = await service.generateContent('node-1', 'u1');

    expect(artifactService.generateArtifact).toHaveBeenCalledWith(
      'node-1',
      'u1',
      ArtifactKind.L3_CORE_TEXT,
    );
    expect(result).toMatchObject({ id: 'c1', coreText: '新生成' });
  });
});
