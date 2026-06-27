import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NodeLearningStatus } from '@skill/shared';
import { NodeLearningRecord } from './entities/node-learning-record.entity';

@Injectable()
export class NodeLearningRecordService {
  constructor(
    @InjectRepository(NodeLearningRecord)
    private recordRepo: Repository<NodeLearningRecord>,
  ) {}

  async findBySkillTree(userId: string, skillTreeId: string): Promise<NodeLearningRecord[]> {
    return this.recordRepo.find({
      where: { userId, skillTreeId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findRecentByUser(userId: string, limit = 5): Promise<NodeLearningRecord[]> {
    return this.recordRepo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
      take: limit,
    });
  }

  async updateStatus(
    userId: string,
    skillTreeId: string,
    nodeId: string,
    status: NodeLearningStatus,
  ): Promise<NodeLearningRecord> {
    let record = await this.recordRepo.findOne({
      where: { userId, skillTreeId, nodeId },
    });

    if (!record) {
      record = this.recordRepo.create({
        userId,
        skillTreeId,
        nodeId,
        status,
      });
    } else {
      record.status = status;
    }

    if (status === NodeLearningStatus.IN_PROGRESS && !record.startedAt) {
      record.startedAt = new Date();
    }

    if (status === NodeLearningStatus.COMPLETED) {
      record.completedAt = new Date();
    } else {
      record.completedAt = undefined;
    }

    return this.recordRepo.save(record);
  }

  async getProgress(userId: string, skillTreeId: string, totalL2Nodes: number): Promise<number> {
    const completedCount = await this.recordRepo.count({
      where: {
        userId,
        skillTreeId,
        status: NodeLearningStatus.COMPLETED,
      },
    });

    if (totalL2Nodes === 0) return 0;
    return Math.round((completedCount / totalL2Nodes) * 100);
  }

  async getProgressByUser(userId: string): Promise<Record<string, number>> {
    const records = await this.recordRepo.find({
      where: {
        userId,
        status: NodeLearningStatus.COMPLETED,
      },
      select: ['skillTreeId'],
    });

    const counts: Record<string, number> = {};
    for (const record of records) {
      counts[record.skillTreeId] = (counts[record.skillTreeId] || 0) + 1;
    }
    return counts;
  }
}
