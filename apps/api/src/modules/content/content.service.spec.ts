import { ContentService } from './content.service';
import { NodeLevel } from '@skill/shared';

describe('ContentService.generateContent（codeExamples 落子表）', () => {
  let service: ContentService;
  let contentRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let exerciseRepo: { create: jest.Mock; save: jest.Mock };
  let codeExampleRepo: { create: jest.Mock; save: jest.Mock };
  let nodeRepo: { findOne: jest.Mock };
  let treeRepo: { findOne: jest.Mock };
  let aiService: { generateL3: jest.Mock };

  beforeEach(() => {
    contentRepo = {
      findOne: jest.fn(async () => null),
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ ...v, id: 'content-1' })),
    };
    exerciseRepo = { create: jest.fn((v) => v), save: jest.fn(async (v) => v) };
    codeExampleRepo = { create: jest.fn((v) => v), save: jest.fn(async (v) => v) };
    nodeRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'node-1',
          treeId: 'tree-1',
          parentId: 'l1-1',
          level: NodeLevel.L2,
          title: 'L2 主题',
        })
        .mockResolvedValueOnce({ id: 'l1-1', title: 'L1 领域' }),
    };
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
    service = new ContentService(
      contentRepo as never,
      exerciseRepo as never,
      codeExampleRepo as never,
      nodeRepo as never,
      treeRepo as never,
      aiService as never,
    );
  });

  it('把 codeExamples 与 exercises 分别写入子表', async () => {
    await service.generateContent('node-1');

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
});
