import { Injectable } from '@nestjs/common';
import { NodeLearningStatus } from '@skill/shared';
import { UserService } from '../user/user.service';
import { LearningRecordService } from '../learning-record/learning-record.service';
import { SkillTreeService } from '../skill-tree/skill-tree.service';
import { NodeLearningRecordService } from '../learning-record/node-learning-record.service';

@Injectable()
export class DashboardService {
  constructor(
    private userService: UserService,
    private learningRecordService: LearningRecordService,
    private skillTreeService: SkillTreeService,
    private nodeLearningRecordService: NodeLearningRecordService,
  ) {}

  async getDashboard(userId: string) {
    const profile = await this.userService.getProfile(userId);
    const portrait = (profile?.computedPortrait as Record<string, unknown>) || null;

    const records = await this.learningRecordService.findByUser(userId);
    const completedCounts = await this.nodeLearningRecordService.getProgressByUser(userId);

    // Cache tree lookups to avoid duplicate DB queries between records and recent nodes.
    // 树为私有资源：传入 userId 使归属校验生效（他人的树会抛 Forbidden 并被 catch 成 null）
    const treeCache = new Map<string, Awaited<ReturnType<typeof this.skillTreeService.findById>> | null>();
    const getTree = async (skillTreeId: string) => {
      if (treeCache.has(skillTreeId)) return treeCache.get(skillTreeId);
      const tree = await this.skillTreeService.findById(skillTreeId, userId).catch(() => null);
      treeCache.set(skillTreeId, tree);
      return tree;
    };

    const learningRecords = await Promise.all(
      records.map(async (record) => {
        const skillTree = await getTree(record.skillTreeId);
        const totalL2Nodes = skillTree?.nodes.filter((n) => n.level === 2).length ?? 0;
        const completedCount = completedCounts[record.skillTreeId] || 0;
        const progress = totalL2Nodes === 0 ? 0 : Math.round((completedCount / totalL2Nodes) * 100);
        return {
          ...record,
          skillTree,
          progress,
        };
      }),
    );

    const recentNodeRecords = (await this.nodeLearningRecordService.findRecentByUser(userId, 5)).filter(
      (record) => record.status === NodeLearningStatus.IN_PROGRESS,
    );
    const recentLearningNodes = await Promise.all(
      recentNodeRecords.map(async (record) => {
        const skillTree = await getTree(record.skillTreeId);
        const node = skillTree?.nodes.find((n) => n.id === record.nodeId) ?? null;
        return {
          ...record,
          skillTree,
          node,
        };
      }),
    );

    const currentLearning = learningRecords
      .filter((record) => record.status !== 'ABANDONED')
      .map((record) => {
        const lastNode = recentLearningNodes.find((n) => n.skillTreeId === record.skillTreeId) ?? null;
        return {
          skillTreeId: record.skillTreeId,
          skillTree: record.skillTree,
          status: record.status,
          progress: record.progress,
          lastNode: lastNode
            ? {
                id: lastNode.nodeId,
                title: lastNode.node?.title || '',
                status: lastNode.status,
                updatedAt: lastNode.updatedAt,
              }
            : null,
        };
      })
      .filter((item) => item.lastNode);

    return {
      portrait,
      learningRecords,
      currentLearning,
    };
  }
}
